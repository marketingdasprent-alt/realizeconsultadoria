// Gmail API (https://gmail.googleapis.com/gmail/v1/users/me/...).

import { mailError } from '../../_shared/mail/errors.ts';
import { gmailListQuery } from '../../_shared/mail/folders.ts';
import {
  decodeGmailPartData,
  findGmailPart,
  gmailHeader,
  listGmailInlineParts,
  parseGmailMessage,
  parseGmailSummary,
  pickGmailBodyParts,
  type GmailMessage,
  type GmailMessagePart,
} from '../../_shared/mail/gmail-parse.ts';
import { referencedContentIds, replaceCidLinks } from '../../_shared/mail/html.ts';
import {
  base64UrlEncode,
  base64UrlToBase64,
  buildRawMessage,
  generateMessageId,
  randomHex,
} from '../../_shared/mail/mime.ts';
import type { MailDriver, MailSendParams, MailSummary } from '../../_shared/mail/types.ts';
import { mapWithConcurrency } from '../../_shared/mail-server/http.ts';
import type { OAuthSession } from '../session.ts';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_UPLOAD_SEND =
  'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart';
const METADATA =
  'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date';
/** Acima disto o JSON { raw } (base64url, +33%) passa o limite do endpoint simples; usa-se o upload. */
const SIMPLE_SEND_MAX = 3 * 1024 * 1024;
const INLINE_IMAGE_MAX = 512 * 1024;
const INLINE_IMAGE_COUNT = 10;

const enc = encodeURIComponent;

export const createGmailDriver = (
  session: OAuthSession,
  account: { email: string; display_name: string | null }
): MailDriver => {
  const getFull = (id: string) =>
    session.json<GmailMessage>(`${GMAIL}/messages/${enc(id)}?format=full`);

  /** Dados (base64url) de uma parte guardada à parte (anexos e corpos grandes). */
  const attachmentData = async (
    messageId: string,
    attachmentId: string
  ): Promise<string | null> => {
    const res = await session.json<{ data?: string }>(
      `${GMAIL}/messages/${enc(messageId)}/attachments/${enc(attachmentId)}`
    );
    return res.data ?? null;
  };

  const partData = async (messageId: string, part: GmailMessagePart): Promise<string | null> => {
    if (part.body?.data) return part.body.data;
    return part.body?.attachmentId ? attachmentData(messageId, part.body.attachmentId) : null;
  };

  const modify = async (id: string, add: string[], remove: string[]) => {
    await session.json(`${GMAIL}/messages/${enc(id)}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
    });
  };

  return {
    async list({ folder, query, pageToken, limit }) {
      const { q, includeSpamTrash } = gmailListQuery(folder, query);
      const params = new URLSearchParams({ q, maxResults: String(limit) });
      if (includeSpamTrash) params.set('includeSpamTrash', 'true');
      if (pageToken) params.set('pageToken', pageToken);
      const list = await session.json<{ messages?: { id: string }[]; nextPageToken?: string }>(
        `${GMAIL}/messages?${params.toString()}`
      );

      const summaries = await mapWithConcurrency(list.messages ?? [], 10, async ({ id }) => {
        const res = await session.fetch(`${GMAIL}/messages/${enc(id)}?${METADATA}`);
        if (res.status === 404) return null; // apagada entretanto
        await session.ensureOk(res);
        return parseGmailSummary((await res.json()) as GmailMessage);
      });
      return {
        messages: summaries.filter((s): s is MailSummary => s !== null),
        next_page_token: list.nextPageToken ?? null,
      };
    },

    async get(messageId) {
      const message = await getFull(messageId);
      const bodies = pickGmailBodyParts(message.payload);
      const [htmlData, textData] = await Promise.all([
        bodies.html ? partData(messageId, bodies.html) : Promise.resolve(null),
        bodies.text ? partData(messageId, bodies.text) : Promise.resolve(null),
      ]);
      let html =
        bodies.html && htmlData !== null ? decodeGmailPartData(bodies.html, htmlData) : null;
      const text =
        bodies.text && textData !== null ? decodeGmailPartData(bodies.text, textData) : null;

      // Imagens inline (assinaturas, logótipos): cid: → data: para o browser as mostrar.
      const embedded = new Set<string>();
      if (html) {
        const used = referencedContentIds(html);
        const inline = listGmailInlineParts(message.payload)
          .filter(p => used.has(p.contentId) && p.size <= INLINE_IMAGE_MAX)
          .slice(0, INLINE_IMAGE_COUNT);
        const urls: Record<string, string> = {};
        await mapWithConcurrency(inline, 4, async p => {
          const data =
            p.data ?? (p.attachmentId ? await attachmentData(messageId, p.attachmentId) : null);
          if (!data) return;
          urls[p.contentId] = `data:${p.mime};base64,${base64UrlToBase64(data)}`;
          embedded.add(p.partId);
        });
        html = replaceCidLinks(html, urls);
      }

      return parseGmailMessage(message, { html, text, excludePartIds: embedded });
    },

    async attachment(messageId, attachmentId) {
      // O id do anexo é o partId (o attachmentId do Gmail muda a cada leitura da mensagem).
      const message = await getFull(messageId);
      const part = findGmailPart(message.payload, attachmentId);
      const data = part ? await partData(messageId, part) : null;
      if (!part || data === null) throw mailError('message_not_found', 'Anexo não encontrado.');
      return {
        filename: part.filename || 'anexo',
        mime: (part.mimeType ?? 'application/octet-stream').toLowerCase(),
        base64: base64UrlToBase64(data),
      };
    },

    async send(params: MailSendParams) {
      let threadId: string | null = null;
      let inReplyTo: string | null = null;
      let references: string | null = null;
      if (params.inReplyTo) {
        const res = await session.fetch(
          `${GMAIL}/messages/${enc(params.inReplyTo)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`
        );
        // Se o original já não existir, segue como mensagem nova.
        if (res.ok) {
          const original = (await res.json()) as GmailMessage;
          threadId = original.threadId ?? null;
          inReplyTo = gmailHeader(original.payload?.headers, 'Message-ID');
          const previous = gmailHeader(original.payload?.headers, 'References');
          references = inReplyTo ? [previous, inReplyTo].filter(Boolean).join(' ') : previous;
        } else {
          await res.body?.cancel();
        }
      }

      const raw = buildRawMessage({
        from: { name: account.display_name, email: account.email },
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        // O Gmail lê o Bcc do cabeçalho e retira-o antes de entregar.
        includeBcc: true,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments.map((a, i) => ({
          filename: a.filename,
          mime: a.mime,
          content: params.attachmentBytes[i],
        })),
        inReplyTo,
        references,
        messageId: generateMessageId(account.email),
      });

      let sent: { id?: string };
      if (raw.length <= SIMPLE_SEND_MAX) {
        sent = await session.json<{ id?: string }>(`${GMAIL}/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            threadId ? { raw: base64UrlEncode(raw), threadId } : { raw: base64UrlEncode(raw) }
          ),
        });
      } else {
        // Upload multipart: metadados (threadId) + mensagem RFC 822 (a mensagem é só ASCII).
        const boundary = `realize_${randomHex(12)}`;
        const body = [
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify(threadId ? { threadId } : {}),
          `--${boundary}`,
          'Content-Type: message/rfc822',
          '',
          raw,
          `--${boundary}--`,
          '',
        ].join('\r\n');
        sent = await session.json<{ id?: string }>(GMAIL_UPLOAD_SEND, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
      }
      return { id: sent.id ?? null };
    },

    async setRead(messageId, read) {
      await modify(messageId, read ? [] : ['UNREAD'], read ? ['UNREAD'] : []);
    },

    async setStarred(messageId, starred) {
      await modify(messageId, starred ? ['STARRED'] : [], starred ? [] : ['STARRED']);
    },

    async trash(messageId) {
      await session.json(`${GMAIL}/messages/${enc(messageId)}/trash`, { method: 'POST' });
    },
  };
};
