// Microsoft Graph (Outlook.com, Microsoft 365, Exchange Online): /v1.0/me/... ou, nas caixas
// da empresa lidas com a permissão da app, /v1.0/users/<email>/...

import { mailError } from '../../_shared/mail/errors.ts';
import {
  GRAPH_BASE,
  GRAPH_SUMMARY_FIELDS,
  GRAPH_SYSTEM_FOLDERS,
  buildGraphListUrl,
  graphCustomFolders,
  isAllowedGraphNextLink,
  type GraphFolderEntry,
} from '../../_shared/mail/folders.ts';
import {
  GRAPH_SMALL_ATTACHMENT_BYTES,
  buildGraphMessage,
  fitsInlineGraphRequest,
  graphUploadRanges,
  toGraphAttachment,
} from '../../_shared/mail/graph-compose.ts';
import {
  graphAttachmentInfo,
  parseGraphMessage,
  parseGraphSummary,
  type GraphAttachment,
  type GraphMessage,
} from '../../_shared/mail/graph-parse.ts';
import {
  normalizeContentId,
  referencedContentIds,
  replaceCidLinks,
} from '../../_shared/mail/html.ts';
import { bytesToBase64 } from '../../_shared/mail/mime.ts';
import type { MailDriver, MailSendParams } from '../../_shared/mail/types.ts';
import {
  errorMessage,
  fetchWithTimeout,
  mapWithConcurrency,
} from '../../_shared/mail-server/http.ts';
import type { OAuthSession } from '../session.ts';

const INLINE_IMAGE_MAX = 512 * 1024;
const INLINE_IMAGE_COUNT = 10;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const enc = encodeURIComponent;
export const createGraphDriver = (session: OAuthSession, ME = `${GRAPH_BASE}/me`): MailDriver => {
  const messageUrl = (id: string) => `${ME}/messages/${enc(id)}`;
  const patchMessage = async (id: string, body: Record<string, unknown>) => {
    await session.json(messageUrl(id), {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  };

  /**
   * POST com resposta 202 sem corpo (sendMail, reply, send). Com `allowNotFound`, um 404
   * (mensagem original apagada) devolve false em vez de erro.
   */
  const postAccepted = async (
    url: string,
    body?: Record<string, unknown>,
    allowNotFound = false
  ): Promise<boolean> => {
    const res = await session.fetch(
      url,
      body
        ? { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }
        : { method: 'POST' }
    );
    if (allowNotFound && res.status === 404) {
      await res.body?.cancel();
      return false;
    }
    await session.ensureOk(res);
    await res.body?.cancel();
    return true;
  };

  /** Rascunho de resposta (createReply) ou, sem original, rascunho novo. */
  const createDraft = async (
    message: Record<string, unknown>,
    inReplyTo: string | null
  ): Promise<string> => {
    if (inReplyTo) {
      const res = await session.fetch(`${messageUrl(inReplyTo)}/createReply`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ message }),
      });
      if (res.status !== 404) {
        await session.ensureOk(res);
        return ((await res.json()) as { id: string }).id;
      }
      await res.body?.cancel();
    }
    const draft = await session.json<{ id: string }>(`${ME}/messages`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(message),
    });
    return draft.id;
  };

  /** Anexo grande num rascunho: sessão de upload em pedaços de 320 KiB × 9. */
  const uploadLargeAttachment = async (
    draftId: string,
    name: string,
    mime: string,
    bytes: Uint8Array
  ) => {
    const upload = await session.json<{ uploadUrl?: string }>(
      `${messageUrl(draftId)}/attachments/createUploadSession`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          AttachmentItem: { attachmentType: 'file', name, size: bytes.length, contentType: mime },
        }),
      }
    );
    if (!upload.uploadUrl?.startsWith('https://')) throw mailError('provider_error');
    for (const { start, end } of graphUploadRanges(bytes.length)) {
      // O uploadUrl já vem autenticado: não se envia o Authorization.
      let res: Response;
      try {
        res = await fetchWithTimeout(
          upload.uploadUrl,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
            },
            body: bytes.slice(start, end + 1),
          },
          60_000
        );
      } catch (error) {
        console.error('mail-api microsoft: upload sem resposta', errorMessage(error));
        throw mailError('provider_error', 'Falhou o envio do anexo para a Microsoft.');
      }
      await res.body?.cancel();
      if (!res.ok) throw mailError('provider_error', 'Falhou o envio do anexo para a Microsoft.');
    }
  };

  /** Rascunho com o texto e os anexos (pequenos no pedido, grandes em upload por partes). */
  const draftWithAttachments = async (params: MailSendParams): Promise<string> => {
    const draftId = await createDraft(
      buildGraphMessage({
        subject: params.subject,
        html: params.html,
        text: params.text,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
      }),
      params.inReplyTo
    );
    for (let i = 0; i < params.attachments.length; i++) {
      const attachment = params.attachments[i];
      const bytes = params.attachmentBytes[i];
      if (bytes.length < GRAPH_SMALL_ATTACHMENT_BYTES) {
        await session.json(`${messageUrl(draftId)}/attachments`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(toGraphAttachment(attachment)),
        });
      } else {
        await uploadLargeAttachment(draftId, attachment.filename, attachment.mime, bytes);
      }
    }
    return draftId;
  };

  /** Apaga de vez (não vai para os Itens Eliminados); já apagado não é erro. */
  const removeDraft = async (messageId: string) => {
    const res = await session.fetch(`${messageUrl(messageId)}/permanentDelete`, {
      method: 'POST',
    });
    if (res.status !== 404) await session.ensureOk(res);
    await res.body?.cancel();
  };

  return {
    async list({ folder, query, pageToken, limit, folderId }) {
      let url: string;
      let postFilterFlagged = false;
      let postFilterUnread = false;
      if (pageToken) {
        if (!isAllowedGraphNextLink(pageToken)) throw mailError('bad_request');
        url = pageToken;
        postFilterFlagged = !folderId && folder === 'starred' && !!query;
        postFilterUnread = !folderId && folder === 'unread' && !!query;
      } else {
        ({ url, postFilterFlagged, postFilterUnread } = buildGraphListUrl(folder, {
          query,
          limit,
          root: ME,
          folderId,
        }));
      }

      const res = await session.fetch(url);
      // Caixas sem pasta Arquivo devolvem 404: lista vazia.
      if (res.status === 404 && folder === 'archive') {
        await res.body?.cancel();
        return { messages: [], next_page_token: null };
      }
      await session.ensureOk(res);
      const data = (await res.json()) as { value?: GraphMessage[]; '@odata.nextLink'?: string };
      let messages = (data.value ?? []).map(parseGraphSummary);
      if (postFilterFlagged) messages = messages.filter(m => m.starred);
      if (postFilterUnread) messages = messages.filter(m => m.unread);
      return { messages, next_page_token: data['@odata.nextLink'] ?? null };
    },

    async get(messageId) {
      const select = [
        ...GRAPH_SUMMARY_FIELDS,
        'body',
        'ccRecipients',
        'replyTo',
        'internetMessageId',
        'internetMessageHeaders',
      ].join(',');
      const message = await session.json<GraphMessage>(
        `${messageUrl(messageId)}?$select=${select}`
      );
      const isHtml = (message.body?.contentType ?? '').toLowerCase() === 'html';
      let html = isHtml ? (message.body?.content ?? null) : null;

      let attachments: GraphAttachment[] = [];
      if (message.hasAttachments || (html && /cid:/i.test(html))) {
        const list = await session.json<{ value?: GraphAttachment[] }>(
          `${messageUrl(messageId)}/attachments?$select=id,name,contentType,size,isInline`
        );
        attachments = list.value ?? [];
      }

      // Imagens inline (cid:) → data: URLs; essas deixam de aparecer como anexos.
      const embedded = new Set<string>();
      if (html) {
        const used = referencedContentIds(html);
        const candidates = attachments
          .filter(a => a.isInline && (a.size ?? 0) <= INLINE_IMAGE_MAX)
          .slice(0, INLINE_IMAGE_COUNT);
        const urls: Record<string, string> = {};
        if (used.size && candidates.length) {
          await mapWithConcurrency(candidates, 4, async a => {
            const full = await session.json<GraphAttachment>(
              `${messageUrl(messageId)}/attachments/${enc(a.id)}`
            );
            const cid = full.contentId ? normalizeContentId(full.contentId) : null;
            if (!cid || !used.has(cid) || !full.contentBytes) return;
            urls[cid] =
              `data:${(full.contentType ?? 'image/png').toLowerCase()};base64,${full.contentBytes}`;
            embedded.add(a.id);
          });
          html = replaceCidLinks(html, urls);
        }
      }

      return parseGraphMessage(message, attachments, {
        html: isHtml ? html : undefined,
        excludeAttachmentIds: embedded,
      });
    },

    async attachment(messageId, attachmentId) {
      const url = `${messageUrl(messageId)}/attachments/${enc(attachmentId)}`;
      const notFound = mailError('message_not_found', 'Anexo não encontrado.');
      const res = await session.fetch(url);
      await session.ensureOk(res, notFound);
      const attachment = (await res.json()) as GraphAttachment;
      const info = graphAttachmentInfo(attachment);
      if (attachment.contentBytes) {
        return { filename: info.filename, mime: info.mime, base64: attachment.contentBytes };
      }
      // Email anexado (itemAttachment): o MIME completo vem em /$value.
      const raw = await session.fetch(`${url}/$value`);
      if (!raw.ok) {
        await raw.body?.cancel();
        throw mailError('not_supported', 'Este tipo de anexo não pode ser descarregado.');
      }
      return {
        filename: info.filename,
        mime: info.mime,
        base64: bytesToBase64(new Uint8Array(await raw.arrayBuffer())),
      };
    },

    async send(params: MailSendParams) {
      const outgoing = {
        subject: params.subject,
        html: params.html,
        text: params.text,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
      };

      // Caso normal: um só pedido (reply mantém a conversa e os cabeçalhos In-Reply-To).
      if (fitsInlineGraphRequest(params.attachments, params.html.length + params.text.length)) {
        const message = buildGraphMessage({ ...outgoing, attachments: params.attachments });
        const replied =
          !!params.inReplyTo &&
          (await postAccepted(`${messageUrl(params.inReplyTo)}/reply`, { message }, true));
        // Mensagem nova (ou o original já não existe: segue como nova, como no Gmail).
        if (!replied) await postAccepted(`${ME}/sendMail`, { message, saveToSentItems: true });
        return { id: null };
      }

      // Anexos grandes (pedidos JSON do Graph têm limite de 4 MB): rascunho → anexos → enviar.
      // Se algo falhar a meio, o rascunho fica nos Rascunhos para o utilizador decidir.
      const draftId = await draftWithAttachments(params);
      await postAccepted(`${messageUrl(draftId)}/send`);
      return { id: null };
    },

    async saveDraft(params: MailSendParams, draftId: string | null) {
      // Um rascunho novo com tudo (texto e anexos) e só depois sai o anterior: se falhar a meio,
      // o que estava guardado continua lá.
      const id = await draftWithAttachments(params);
      if (draftId && draftId !== id) await removeDraft(draftId).catch(() => undefined);
      return { id };
    },

    async deleteDraft(messageId: string) {
      await removeDraft(messageId);
    },

    async setRead(messageId, read) {
      await patchMessage(messageId, { isRead: read });
    },

    async setStarred(messageId, starred) {
      await patchMessage(messageId, { flag: { flagStatus: starred ? 'flagged' : 'notFlagged' } });
    },

    async trash(messageId) {
      await session.json(`${messageUrl(messageId)}/move`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ destinationId: 'deleteditems' }),
      });
    },

    async thread(threadId: string) {
      // Todas as pastas (Entrada, Enviados…); ordena-se aqui (o Graph recusa ordenar com este filtro).
      const filter = encodeURIComponent(`conversationId eq '${threadId.replace(/'/g, "''")}'`);
      const data = await session.json<{ value?: GraphMessage[] }>(
        `${ME}/messages?$filter=${filter}&$top=50&$select=${GRAPH_SUMMARY_FIELDS.join(',')}`
      );
      return (data.value ?? [])
        .filter(m => !m.isDraft)
        .map(parseGraphSummary)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    async unreadCount() {
      const inbox = await session.json<{ unreadItemCount?: number }>(
        `${ME}/mailFolders/inbox?$select=unreadItemCount`
      );
      return inbox.unreadItemCount ?? 0;
    },

    async folders() {
      // Os ids das pastas de sistema (num só pedido $batch) e a árvore toda, nível a nível.
      const relative = ME.slice(GRAPH_BASE.length);
      const batch = await session.json<{
        responses?: { id: string; status: number; body?: { id?: string } }[];
      }>(`${GRAPH_BASE}/$batch`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          requests: GRAPH_SYSTEM_FOLDERS.map(name => ({
            id: name,
            method: 'GET',
            url: `${relative}/mailFolders/${name}?$select=id`,
          })),
        }),
      });
      const system = new Map<string, string>();
      for (const r of batch.responses ?? []) {
        if (r.status === 200 && r.body?.id) system.set(r.body.id, r.id);
      }

      const select =
        '$select=id,displayName,parentFolderId,unreadItemCount,childFolderCount&$top=250';
      type Entry = GraphFolderEntry & { childFolderCount?: number };
      const all: Entry[] = [];
      let level =
        (await session.json<{ value?: Entry[] }>(`${ME}/mailFolders?${select}`)).value ?? [];
      for (let depth = 0; level.length && depth < 6 && all.length < 1000; depth++) {
        all.push(...level);
        const parents = level.filter(f => (f.childFolderCount ?? 0) > 0);
        const children = await mapWithConcurrency(
          parents,
          6,
          async parent =>
            (
              await session.json<{ value?: Entry[] }>(
                `${ME}/mailFolders/${enc(parent.id)}/childFolders?${select}`
              )
            ).value ?? []
        );
        level = children.flat();
      }
      return graphCustomFolders(all, system);
    },
  };
};
