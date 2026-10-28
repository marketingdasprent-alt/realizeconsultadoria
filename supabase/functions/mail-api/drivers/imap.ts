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

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;
import { isMailError, mailError, type MailError } from '../../_shared/mail/errors.ts';
import {
  decodeImapMessageId,
  encodeImapMessageId,
  customImapFolders,
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
  status(path: string, query: { unseen?: boolean }): Promise<{ unseen?: number }>;
  search(query: Record<string, unknown>, options: UidOption): Promise<number[] | false>;
  fetch(range: string, query: FetchQuery, options: UidOption): AsyncIterable<ImapFetchMessage>;
  fetchOne(range: string, query: FetchQuery, options: UidOption): Promise<ImapFetchMessage | false>;
  messageFlagsAdd(range: string, flags: string[], options: UidOption): Promise<boolean>;
  messageFlagsRemove(range: string, flags: string[], options: UidOption): Promise<boolean>;
  messageMove(range: string, destination: string, options: UidOption): Promise<unknown>;
  append(path: string, content: string, flags?: string[]): Promise<{ uid?: number } | false>;
  messageDelete(range: string, options: UidOption): Promise<boolean>;
  download(
    range: string,
    part: string,
    options: UidOption
  ): Promise<{ content: AsyncIterable<Uint8Array> }>;
}

/** Nó da estrutura MIME (imapflow bodyStructure). */
interface ImapBodyPart {
  part?: string;
  type?: string;
  parameters?: Record<string, string>;
  dispositionParameters?: Record<string, string>;
  childNodes?: ImapBodyPart[];
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

// ---------------------------------------------------------------- reserva de ligações

/**
 * Ligações IMAP abertas, reaproveitadas enquanto o worker da função estiver vivo: abrir
 * (TLS + login) custa 1–3 s e cada clique no Webmail é um pedido novo. Uma ligação por
 * caixa, com as operações em fila; fecha ao fim de IDLE_MS sem uso.
 */
interface PooledClient {
  client: ImapClient;
  queue: Promise<unknown>;
  idle: ReturnType<typeof setTimeout> | null;
}
const POOL = new Map<string, PooledClient>();
const IDLE_MS = 90_000;

/** Chave da ligação (a palavra-passe entra só como hash, para uma mudança abrir outra). */
const poolKey = (cfg: ImapAccountConfig) => {
  let hash = 0;
  for (const char of cfg.password) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${cfg.username}@${cfg.imapHost}:${cfg.imapPort}#${hash}`;
};

const isUsable = (client: ImapClient) => (client as { usable?: boolean }).usable !== false;

const dropPooled = (key: string) => {
  const entry = POOL.get(key);
  if (!entry) return;
  POOL.delete(key);
  if (entry.idle) clearTimeout(entry.idle);
  entry.client.logout().catch(() => entry.client.close());
};

// ---------------------------------------------------------------- driver

export const createImapDriver = (
  cfg: ImapAccountConfig,
  onAuthFailure: () => Promise<MailError>
): MailDriver => {
  const key = poolKey(cfg);

  const acquire = async (): Promise<{ entry: PooledClient; reused: boolean }> => {
    const pooled = POOL.get(key);
    if (pooled && isUsable(pooled.client)) return { entry: pooled, reused: true };
    if (pooled) dropPooled(key);
    let client: ImapClient;
    try {
      client = await openClient(cfg);
    } catch (error) {
      if (isAuthFailure(error)) throw await onAuthFailure();
      console.error('mail-api imap: sem ligação', errorMessage(error));
      throw mailError('provider_error', `Não foi possível ligar a ${cfg.imapHost}.`);
    }
    const entry: PooledClient = { client, queue: Promise.resolve(), idle: null };
    POOL.set(key, entry);
    return { entry, reused: false };
  };

  const run = <T>(entry: PooledClient, fn: (client: ImapClient) => Promise<T>): Promise<T> => {
    if (entry.idle) clearTimeout(entry.idle);
    const result = entry.queue.then(() => fn(entry.client));
    entry.queue = result.catch(() => undefined);
    entry.queue.then(() => {
      if (POOL.get(key) !== entry) return;
      if (entry.idle) clearTimeout(entry.idle);
      entry.idle = setTimeout(() => dropPooled(key), IDLE_MS);
    });
    return result;
  };

  const withClient = async <T>(fn: (client: ImapClient) => Promise<T>): Promise<T> => {
    const { entry, reused } = await acquire();
    try {
      return await run(entry, fn);
    } catch (error) {
      // Erros de negócio passam; um erro de ligação numa ligação reaproveitada (o servidor
      // fechou-a entretanto) tenta uma vez com uma ligação nova.
      if (isMailError(error)) throw error;
      const dead = !isUsable(entry.client);
      dropPooled(key);
      // Só se a ligação morreu (o pedido não chegou a ser feito), para não repetir operações.
      if (!reused || !dead) throw error;
      const fresh = await acquire();
      return run(fresh.entry, fn);
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

  /**
   * Só a parte do anexo (sem descarregar e ler o email inteiro): procura na estrutura a única
   * parte com esse nome de ficheiro. Nome repetido, sem nome ou erro: null (usa-se o caminho
   * completo, que nunca entrega o anexo errado).
   */
  const quickAttachment = (client: ImapClient, messageId: string, filename: string) => {
    const { path, uid } = ref(messageId);
    return withMailbox(client, path, true, async () => {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, bodyStructure: true },
        { uid: true }
      );
      const leaves: ImapBodyPart[] = [];
      const walk = (node?: ImapBodyPart) => {
        if (!node) return;
        if (node.childNodes?.length) node.childNodes.forEach(walk);
        else leaves.push(node);
      };
      walk(
        msg ? (msg as ImapFetchMessage & { bodyStructure?: ImapBodyPart }).bodyStructure : undefined
      );
      const named = leaves.filter(
        node => (node.dispositionParameters?.filename ?? node.parameters?.name) === filename
      );
      if (named.length !== 1 || !named[0].part) return null;
      const download = await client.download(String(uid), named[0].part, { uid: true });
      const chunks: Uint8Array[] = [];
      for await (const chunk of download.content) chunks.push(chunk);
      const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return {
        filename,
        mime: (named[0].type ?? 'application/octet-stream').toLowerCase(),
        base64: bytesToBase64(bytes),
      };
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
    list({ folder, query, pageToken, limit, withoutSnippets, folderId }) {
      return withClient(async client => {
        const empty: MailListResult = { messages: [], next_page_token: null };
        const before = pageToken ? Number(pageToken) : null;
        if (before !== null && (!Number.isInteger(before) || before <= 1)) return empty;

        // A Entrada é sempre "INBOX": poupa o LIST de todas as pastas (um pedido a menos).
        // Pasta da pessoa: o caminho vem do próprio servidor (lista de pastas).
        if (folderId) folder = 'inbox';
        let path = folderId
          ? folderId
          : folder === 'inbox' || folder === 'unread'
            ? 'INBOX'
            : resolveImapFolder(folder, await client.list());
        // Sem pasta \Flagged: marcadas = \Flagged na INBOX.
        const flaggedSearch = folder === 'starred' && !path;
        if (flaggedSearch) path = 'INBOX';
        if (!path) return empty;
        const mailbox = path;

        return withMailbox(client, mailbox, true, async () => {
          const criteria: Record<string, unknown> = {};
          if (before) criteria.uid = `1:${before - 1}`;
          if (flaggedSearch) criteria.flagged = true;
          if (folder === 'unread') criteria.seen = false;
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
          const snippets = withoutSnippets
            ? new Map<number, string>()
            : await fetchSnippets(client, items);
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

    attachment(messageId, attachmentId, filename) {
      return withClient(async client => {
        if (filename) {
          const quick = await quickAttachment(client, messageId, filename).catch(error => {
            console.warn('mail-api imap: anexo por partes falhou', errorMessage(error));
            return null;
          });
          if (quick) return quick;
        }
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
      // Corre depois da resposta: quem envia não fica à espera de mais uma ligação IMAP.
      if (!AUTO_SAVES_SENT.test(cfg.smtpHost)) {
        const saveCopy = withClient(async client => {
          const sent = resolveImapFolder('sent', await client.list());
          if (sent)
            await client.append(sent, buildRawMessage({ ...base, includeBcc: true }), ['\\Seen']);
        }).catch(error =>
          console.warn('mail-api imap: cópia nos Enviados falhou', errorMessage(error))
        );
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(saveCopy);
        else await saveCopy;
      }
      return { id: null };
    },

    async saveDraft(params: MailSendParams, draftId: string | null) {
      const raw = buildRawMessage({
        from: { name: cfg.displayName, email: cfg.email },
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        includeBcc: true,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments.map((a, i) => ({
          filename: a.filename,
          mime: a.mime,
          content: params.attachmentBytes[i],
        })),
        inReplyTo: null,
        references: null,
        messageId: generateMessageId(cfg.email),
        date: new Date(),
      });
      return withClient(async client => {
        const drafts = resolveImapFolder('drafts', await client.list());
        if (!drafts) throw mailError('provider_error', 'A caixa não tem pasta de rascunhos.');
        const appended = await client.append(drafts, raw, ['\\Draft', '\\Seen']);
        // O anterior só sai depois de o novo estar guardado.
        const previous = draftId ? decodeImapMessageId(draftId) : null;
        if (previous) {
          await withMailbox(client, previous.path, false, () =>
            client.messageDelete(String(previous.uid), { uid: true })
          ).catch(() => undefined);
        }
        const uid = appended && appended.uid;
        return { id: uid ? encodeImapMessageId(drafts, uid) : '' };
      });
    },

    async deleteDraft(messageId: string) {
      const target = decodeImapMessageId(messageId);
      if (!target) return;
      await withClient(client =>
        withMailbox(client, target.path, false, () =>
          client.messageDelete(String(target.uid), { uid: true })
        )
      );
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

    // Sem agrupamento de conversas no IMAP: o leitor mostra só o email aberto.
    thread() {
      return Promise.resolve([]);
    },

    folders() {
      return withClient(async client => customImapFolders(await client.list()));
    },

    unreadCount() {
      // STATUS INBOX (UNSEEN): não abre a pasta nem lê mensagens.
      return withClient(
        async client => (await client.status('INBOX', { unseen: true })).unseen ?? 0
      );
    },
  };
};
