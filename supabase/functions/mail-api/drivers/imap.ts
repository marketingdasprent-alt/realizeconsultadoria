// IMAP + SMTP (iCloud, Yahoo, AOL e servidores próprios) com imapflow, mailparser e
// nodemailer pela compatibilidade Node do Deno.
//
// ATENÇÃO: o funcionamento destes pacotes (node:net/node:tls) no runtime Edge da Supabase
// tem de ser validado depois do deploy: ligação TLS à 993, STARTTLS na 143, envio pela 465
// (a Edge bloqueia 25 e 587) e tempos de resposta com caixas grandes.
//
// Cada pedido abre uma ligação, faz o trabalho e termina sempre com logout (finally).
// Ids de mensagem: "<pasta codificada>:<uid>"; page_token = menor UID já devolvido.

import { ImapFlow } from 'npm:imapflow@1.0.164';
import { simpleParser } from 'npm:mailparser@3.7.1';
import nodemailer from 'npm:nodemailer@6.9.15';
import { mailError, type MailError } from '../../_shared/mail/errors.ts';
import {
  decodeImapMessageId,
  encodeImapMessageId,
  resolveImapFolder,
  type ImapMailboxEntry,
} from '../../_shared/mail/folders.ts';
import {
  imapSnippet,
  imapSummary,
  parsedMailToMessage,
  pickImapSnippetPart,
  type ImapBodyNode,
  type ImapEnvelopeLike,
  type ImapSnippetPart,
  type ParsedAttachmentLike,
  type ParsedMailLike,
} from '../../_shared/mail/imap-parse.ts';
import {
  buildRawMessage,
  bytesToBase64,
  extractHeader,
  generateMessageId,
  utf8Decode,
} from '../../_shared/mail/mime.ts';
import type { MailDriver, MailListResult, MailSendParams } from '../../_shared/mail/types.ts';
import { errorMessage } from '../../_shared/mail-server/http.ts';

// ---------------------------------------------------------------- tipos mínimos dos pacotes

interface ImapFetchMessage {
  uid: number;
  flags?: Set<string>;
  envelope?: ImapEnvelopeLike & { messageId?: string };
  bodyStructure?: ImapBodyNode;
  internalDate?: Date | string;
  source?: Uint8Array;
  bodyParts?: Map<string, Uint8Array>;
  headers?: Uint8Array;
}

interface ImapLock {
  release(): void;
}

type FetchQuery = Record<string, unknown>;
type UidOption = { uid: true };

interface ImapClient {
  connect(): Promise<void>;
  logout(): Promise<void>;
  close(): void;
  on(event: 'error', listener: (error: unknown) => void): void;
  list(): Promise<ImapMailboxEntry[]>;
  getMailboxLock(path: string, options?: { readOnly?: boolean }): Promise<ImapLock>;
  search(query: Record<string, unknown>, options: UidOption): Promise<number[] | false>;
  fetch(range: string, query: FetchQuery, options: UidOption): AsyncIterable<ImapFetchMessage>;
  fetchOne(range: string, query: FetchQuery, options: UidOption): Promise<ImapFetchMessage | false>;
  messageFlagsAdd(range: string, flags: string[], options: UidOption): Promise<boolean>;
  messageFlagsRemove(range: string, flags: string[], options: UidOption): Promise<boolean>;
  messageMove(range: string, destination: string, options: UidOption): Promise<unknown>;
  append(path: string, content: string, flags?: string[]): Promise<unknown>;
}

interface ParsedAttachmentWithContent extends ParsedAttachmentLike {
  content?: Uint8Array;
}

interface ParsedMail extends ParsedMailLike {
  attachments?: ParsedAttachmentWithContent[];
}

interface SmtpTransport {
  sendMail(mail: { envelope: { from: string; to: string[] }; raw: string }): Promise<unknown>;
  close(): void;
}

const ImapFlowClient = ImapFlow as unknown as new (options: Record<string, unknown>) => ImapClient;
const parseMail = simpleParser as unknown as (
  source: Uint8Array,
  options?: Record<string, unknown>
) => Promise<ParsedMail>;
const mailer = nodemailer as unknown as {
  createTransport(options: Record<string, unknown>): SmtpTransport;
};

// ---------------------------------------------------------------- configuração e ligação

export interface ImapAccountConfig {
  email: string;
  displayName: string | null;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

const SNIPPET_PART_MAX = 200_000;
/** Servidores que já guardam nos Enviados o que sai por SMTP (evita cópias duplicadas). */
const AUTO_SAVES_SENT =
  /(^|\.)(gmail\.com|googlemail\.com|office365\.com|outlook\.com|hotmail\.com)$/i;

const isAuthFailure = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { authenticationFailed?: unknown; responseText?: unknown; message?: unknown };
  if (e.authenticationFailed === true) return true;
  const text = `${String(e.responseText ?? '')} ${String(e.message ?? '')}`;
  return /AUTHENTICATIONFAILED|invalid credentials|authentication failed|LOGIN failed/i.test(text);
};

const openClient = async (cfg: ImapAccountConfig): Promise<ImapClient> => {
  const client = new ImapFlowClient({
    host: cfg.imapHost,
    port: cfg.imapPort,
    // 993 = TLS implícito; na 143 o imapflow faz STARTTLS quando o servidor o anuncia.
    secure: cfg.imapPort !== 143,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  });
  // Sem listener, um erro de socket derrubava a função.
  client.on('error', error => console.warn('mail-api imap:', errorMessage(error)));
  await client.connect();
  return client;
};

/** Testa as credenciais (connect-imap). */
export const testImapLogin = async (cfg: ImapAccountConfig): Promise<void> => {
  let client: ImapClient;
  try {
    client = await openClient(cfg);
  } catch (error) {
    console.warn('mail-api imap: login falhou', errorMessage(error));
    throw mailError(
      'imap_login_failed',
      isAuthFailure(error)
        ? undefined
        : `Não foi possível ligar a ${cfg.imapHost}:${cfg.imapPort}. Confirme o servidor e a porta.`
    );
  }
  try {
    await client.logout();
  } catch {
    client.close();
  }
};

// ---------------------------------------------------------------- driver

export const createImapDriver = (
  cfg: ImapAccountConfig,
  onAuthFailure: () => Promise<MailError>
): MailDriver => {
  const withClient = async <T>(fn: (client: ImapClient) => Promise<T>): Promise<T> => {
    let client: ImapClient;
    try {
      client = await openClient(cfg);
    } catch (error) {
      if (isAuthFailure(error)) throw await onAuthFailure();
      console.error('mail-api imap: sem ligação', errorMessage(error));
      throw mailError('provider_error', `Não foi possível ligar a ${cfg.imapHost}.`);
    }
    try {
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
  };

  const withMailbox = async <T>(
    client: ImapClient,
    path: string,
    readOnly: boolean,
    fn: () => Promise<T>
  ): Promise<T> => {
    let lock: ImapLock;
    try {
      lock = await client.getMailboxLock(path, { readOnly });
    } catch {
      throw mailError('message_not_found');
    }
    try {
      return await fn();
    } finally {
      lock.release();
    }
  };

  const ref = (messageId: string) => {
    const decoded = decodeImapMessageId(messageId);
    if (!decoded) throw mailError('message_not_found');
    return decoded;
  };

  /** Pré-visualizações: uma leitura de BODY[parte] por número de parte (sem marcar como lida). */
  const fetchSnippets = async (client: ImapClient, items: ImapFetchMessage[]) => {
    const out = new Map<number, string>();
    const groups = new Map<string, { uid: number; info: ImapSnippetPart }[]>();
    for (const item of items) {
      const info = pickImapSnippetPart(item.bodyStructure);
      if (!info || info.size > SNIPPET_PART_MAX) continue;
      groups.set(info.part, [...(groups.get(info.part) ?? []), { uid: item.uid, info }]);
    }
    try {
      for (const [part, list] of groups) {
        const byUid = new Map(list.map(x => [x.uid, x.info]));
        const range = list.map(x => x.uid).join(',');
        for await (const msg of client.fetch(
          range,
          { uid: true, bodyParts: [part] },
          { uid: true }
        )) {
          const bytes = msg.bodyParts?.get(part) ?? msg.bodyParts?.get(part.toLowerCase());
          const info = byUid.get(msg.uid);
          if (bytes && info) out.set(msg.uid, imapSnippet(bytes, info));
        }
      }
    } catch (error) {
      console.warn('mail-api imap: sem pré-visualizações', errorMessage(error));
    }
    return out;
  };

  const loadParsed = (client: ImapClient, messageId: string) => {
    const { path, uid } = ref(messageId);
    return withMailbox(client, path, true, async () => {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, source: true, flags: true, internalDate: true },
        { uid: true }
      );
      if (!msg || !msg.source) throw mailError('message_not_found');
      // Opções por omissão do mailparser: imagens inline (cid:) passam a data: URLs no HTML.
      const parsed = await parseMail(msg.source, { skipTextToHtml: true, skipTextLinks: true });
      return { parsed, msg };
    });
  };

  const setFlag = (messageId: string, flag: string, on: boolean) =>
    withClient(async client => {
      const { path, uid } = ref(messageId);
      await withMailbox(client, path, false, async () => {
        if (on) await client.messageFlagsAdd(String(uid), [flag], { uid: true });
        else await client.messageFlagsRemove(String(uid), [flag], { uid: true });
      });
    });

  return {
    list({ folder, query, pageToken, limit }) {
      return withClient(async client => {
        const empty: MailListResult = { messages: [], next_page_token: null };
        const before = pageToken ? Number(pageToken) : null;
        if (before !== null && (!Number.isInteger(before) || before <= 1)) return empty;

        const mailboxes = await client.list();
        let path = resolveImapFolder(folder, mailboxes);
        // Sem pasta \Flagged: marcadas = \Flagged na INBOX.
        const flaggedSearch = folder === 'starred' && !path;
        if (flaggedSearch) path = 'INBOX';
        if (!path) return empty;
        const mailbox = path;

        return withMailbox(client, mailbox, true, async () => {
          const criteria: Record<string, unknown> = {};
          if (before) criteria.uid = `1:${before - 1}`;
          if (flaggedSearch) criteria.flagged = true;
          if (query) criteria.or = [{ subject: query }, { from: query }, { body: query }];
          if (!Object.keys(criteria).length) criteria.all = true;

          const found = await client.search(criteria, { uid: true });
          const uids = (Array.isArray(found) ? found : []).sort((a, b) => b - a);
          const page = uids.slice(0, limit);
          if (!page.length) return empty;

          const items: ImapFetchMessage[] = [];
          for await (const msg of client.fetch(
            page.join(','),
            { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true },
            { uid: true }
          )) {
            items.push(msg);
          }
          const snippets = await fetchSnippets(client, items);
          items.sort((a, b) => b.uid - a.uid);

          return {
            messages: items.map(m =>
              imapSummary({
                id: encodeImapMessageId(mailbox, m.uid),
                envelope: m.envelope,
                flags: m.flags,
                internalDate: m.internalDate,
                bodyStructure: m.bodyStructure,
                snippet: snippets.get(m.uid),
              })
            ),
            next_page_token: uids.length > limit ? String(page[page.length - 1]) : null,
          };
        });
      });
    },

    get(messageId) {
      return withClient(async client => {
        const { parsed, msg } = await loadParsed(client, messageId);
        return parsedMailToMessage(parsed, {
          id: messageId,
          flags: msg.flags,
          internalDate: msg.internalDate,
        });
      });
    },

    attachment(messageId, attachmentId) {
      return withClient(async client => {
        const { parsed } = await loadParsed(client, messageId);
        const attachment = parsed.attachments?.[Number(attachmentId)];
        if (!/^\d+$/.test(attachmentId) || !attachment?.content) {
          throw mailError('message_not_found', 'Anexo não encontrado.');
        }
        return {
          filename: attachment.filename?.trim() || 'anexo',
          mime: (attachment.contentType ?? 'application/octet-stream').toLowerCase(),
          base64: bytesToBase64(attachment.content),
        };
      });
    },

    async send(params: MailSendParams) {
      // Resposta: Message-ID e References do original para o cliente do destinatário agrupar.
      let inReplyTo: string | null = null;
      let references: string | null = null;
      const original = params.inReplyTo ? decodeImapMessageId(params.inReplyTo) : null;
      if (original) {
        try {
          await withClient(client =>
            withMailbox(client, original.path, true, async () => {
              const msg = await client.fetchOne(
                String(original.uid),
                { uid: true, envelope: true, headers: ['references'] },
                { uid: true }
              );
              if (!msg) return;
              inReplyTo = msg.envelope?.messageId ?? null;
              const previous = msg.headers
                ? extractHeader(utf8Decode(msg.headers), 'References')
                : null;
              references = inReplyTo ? [previous, inReplyTo].filter(Boolean).join(' ') : previous;
            })
          );
        } catch (error) {
          console.warn('mail-api imap: original da resposta indisponível', errorMessage(error));
        }
      }

      const base = {
        from: { name: cfg.displayName, email: cfg.email },
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
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
        messageId: generateMessageId(cfg.email),
        date: new Date(),
      };

      // SMTP: o Bcc vai só no envelope, nunca no cabeçalho.
      const transport = mailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: true,
        auth: { user: cfg.username, pass: cfg.password },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 60_000,
      });
      try {
        await transport.sendMail({
          envelope: {
            from: cfg.email,
            to: [...params.to, ...params.cc, ...params.bcc].map(a => a.email),
          },
          raw: buildRawMessage({ ...base, includeBcc: false }),
        });
      } catch (error) {
        console.error('mail-api smtp: envio falhou', errorMessage(error));
        const code = (error as { code?: unknown } | null)?.code;
        throw mailError(
          'smtp_failed',
          code === 'EAUTH'
            ? 'O servidor SMTP recusou as credenciais. Confirme a palavra-passe de aplicação.'
            : undefined
        );
      } finally {
        transport.close();
      }

      // Cópia nos Enviados (melhor esforço; aqui o Bcc fica, como nos clientes de email).
      if (!AUTO_SAVES_SENT.test(cfg.smtpHost)) {
        try {
          await withClient(async client => {
            const sent = resolveImapFolder('sent', await client.list());
            if (sent)
              await client.append(sent, buildRawMessage({ ...base, includeBcc: true }), ['\\Seen']);
          });
        } catch (error) {
          console.warn('mail-api imap: cópia nos Enviados falhou', errorMessage(error));
        }
      }
      return { id: null };
    },

    setRead(messageId, read) {
      return setFlag(messageId, '\\Seen', read);
    },

    setStarred(messageId, starred) {
      return setFlag(messageId, '\\Flagged', starred);
    },

    trash(messageId) {
      return withClient(async client => {
        const { path, uid } = ref(messageId);
        const trashPath = resolveImapFolder('trash', await client.list());
        if (!trashPath) throw mailError('not_supported', 'Esta caixa não tem pasta de Lixo.');
        if (trashPath === path) return;
        await withMailbox(client, path, false, async () => {
          await client.messageMove(String(uid), trashPath, { uid: true });
        });
      });
    },
  };
};
