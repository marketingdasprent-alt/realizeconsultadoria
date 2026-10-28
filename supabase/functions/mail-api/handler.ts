// API do Webmail: lê e envia email das contas ligadas pelo colaborador.
//
// POST { action, ... } com Authorization: Bearer <JWT do utilizador>. Respostas de negócio
// sempre HTTP 200 com { ok, code?, message?, data? } (snake_case).
//   connect-imap { provider, email, password, imap_host, imap_port, smtp_host, smtp_port,
//                  display_name? }                                   → { id }
//   list   { account_id, folder, folder_id?, query?, page_token?, limit? } → { messages, next_page_token }
//          (folder_id: pasta criada pela pessoa, da lista de "folders"; manda sobre folder)
//   folders { account_id } → MailFolderInfo[] (pastas da pessoa, sem as fixas)
//   get    { account_id, message_id }                                → MailMessage
//   attachment { account_id, message_id, attachment_id }             → { filename, mime, base64 }
//   send   { account_id, to[], cc?[], bcc?[], subject, html, text, in_reply_to?,
//            attachments?: { filename, mime, base64 }[] }            → { id }
//   set-read { account_id, message_id, read } · set-starred { ..., starred } · trash
//   disconnect { account_id }
//   unread-counts → { counts: { [account_id]: n }, errors: { [account_id]: code } } (Entrada de
//                   todas as caixas de quem chama, ver unread.ts)
//   discover { email } → { servers, oauth, source } (servidores IMAP/SMTP do domínio, por DNS)
//   share-access { access_id } (só admin) → caixa partilhada de um email dos Acessos (share.ts)
// Pela BD (cabeçalho x-mail-system-token): { access_id } partilha automática; { action:
// 'poll-new' } avisos de email novo a cada 2 minutos (poll.ts).
//
// Cada ação carrega a conta com service role e `user_id = <quem chama>`; os tokens e
// palavras-passe ficam no Vault e nunca vão para o browser. Drivers: Gmail API,
// Microsoft Graph e IMAP/SMTP. Tokens OAuth renovados aqui (session.ts).
// verify_jwt = false: o JWT é validado aqui (auth.getUser).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MAIL_ERROR_MESSAGES, isMailError, mailError } from '../_shared/mail/errors.ts';
import { isMailFolder } from '../_shared/mail/folders.ts';
import { oauthProviderOfMethod, parseImapSecret, parseOAuthSecret } from '../_shared/mail/oauth.ts';
import {
  isRecord,
  isUuid,
  optionalString,
  parseImapConnectRequest,
  parseListLimit,
  parseSendRequest,
} from '../_shared/mail/request.ts';
import type { MailDriver } from '../_shared/mail/types.ts';
import {
  deleteMailAccount,
  loadAccount,
  readSecret,
  saveMailAccount,
  storeSecret,
  updateAccountStatus,
  type MailAccountRow,
} from '../_shared/mail-server/accounts.ts';
import {
  authenticatedUserId,
  corsHeaders,
  errorMessage,
  json,
  serviceClient,
} from '../_shared/mail-server/http.ts';
import { microsoftAppToken, revokeGoogleToken } from '../_shared/mail-server/oauth-client.ts';
import { GRAPH_BASE } from '../_shared/mail/folders.ts';
import { denoResolver } from '../_shared/mail-server/dns.ts';
import { discoverDomain, domainOfEmail } from '../_shared/mail/discover.ts';
import { createGmailDriver } from './drivers/gmail.ts';
import { createGraphDriver } from './drivers/graph.ts';
import { createImapDriver, testImapLogin, type ImapAccountConfig } from './drivers/imap.ts';
import { pollNewMail } from './poll.ts';
import { OAuthSession } from './session.ts';
import { shareAccess, shareAccessById } from './share.ts';
import { unreadCounts } from './unread.ts';

type Body = Record<string, unknown>;

const ok = (data: unknown = null) => json({ ok: true, data });
const badRequest = () => json({ ok: false, code: 'bad_request' }, 400);

const reauthError = async (db: SupabaseClient, accountId: string) => {
  await updateAccountStatus(db, accountId, {
    status: 'reauth',
    last_error: 'Credenciais inválidas ou autorização revogada.',
  });
  return mailError('reauth');
};

const imapConfig = (
  account: MailAccountRow,
  secret: { username: string; password: string }
): ImapAccountConfig | null =>
  account.imap_host && account.imap_port && account.smtp_host && account.smtp_port
    ? {
        email: account.email,
        displayName: account.display_name,
        username: secret.username,
        password: secret.password,
        imapHost: account.imap_host,
        imapPort: account.imap_port,
        smtpHost: account.smtp_host,
        smtpPort: account.smtp_port,
      }
    : null;

/** Driver do fornecedor da conta, com o segredo do Vault. */
const createDriver = async (
  db: SupabaseClient,
  account: MailAccountRow,
  pendingSecret?: Promise<string | null>
): Promise<MailDriver> => {
  if (account.auth_method === 'app-microsoft') {
    // Caixa da empresa lida com a permissão da própria app: sem segredo no Vault.
    const domain = domainOfEmail(account.email);
    const session = new OAuthSession(
      db,
      account.id,
      'microsoft',
      { access_token: '', refresh_token: null, expires_at: 0, scope: null },
      () =>
        microsoftAppToken(domain).catch(() => {
          throw mailError('provider_error', 'A app Realize não tem permissão para ler esta caixa.');
        })
    );
    return createGraphDriver(session, `${GRAPH_BASE}/users/${encodeURIComponent(account.email)}`);
  }
  const raw = await (pendingSecret ?? readSecret(db, account.id));
  if (account.auth_method === 'imap') {
    const secret = parseImapSecret(raw);
    const config = secret ? imapConfig(account, secret) : null;
    if (!config) throw await reauthError(db, account.id);
    return createImapDriver(config, () => reauthError(db, account.id));
  }
  const oauth = oauthProviderOfMethod(account.auth_method);
  const secret = parseOAuthSecret(raw);
  if (!oauth || !secret) throw await reauthError(db, account.id);
  const session = new OAuthSession(db, account.id, oauth, secret);
  return oauth === 'google' ? createGmailDriver(session, account) : createGraphDriver(session);
};

const requireAccount = async (db: SupabaseClient, userId: string, body: Body) => {
  const account = isUuid(body.account_id) ? await loadAccount(db, body.account_id, userId) : null;
  if (!account) throw mailError('not_found');
  return account;
};

const connectImap = async (db: SupabaseClient, userId: string, body: Body) => {
  const parsed = parseImapConnectRequest(body);
  if (!parsed.ok) {
    return parsed.code === 'bad_request'
      ? badRequest()
      : json({ ok: false, code: parsed.code, message: MAIL_ERROR_MESSAGES[parsed.code] });
  }
  const req = parsed.value;
  await testImapLogin({
    email: req.email,
    displayName: req.displayName,
    username: req.email,
    password: req.password,
    imapHost: req.imapHost,
    imapPort: req.imapPort,
    smtpHost: req.smtpHost,
    smtpPort: req.smtpPort,
  });
  const account = await saveMailAccount(db, {
    userId,
    provider: req.provider,
    authMethod: 'imap',
    email: req.email,
    displayName: req.displayName,
    overrideDisplayName: true,
    server: {
      imapHost: req.imapHost,
      imapPort: req.imapPort,
      smtpHost: req.smtpHost,
      smtpPort: req.smtpPort,
    },
  });
  await storeSecret(db, account.id, { username: req.email, password: req.password });
  return ok({ id: account.id });
};

const disconnect = async (db: SupabaseClient, account: MailAccountRow) => {
  // Caixa partilhada: só o admin a retira (nos Acessos).
  if (account.access_id) throw mailError('shared_account');
  if (account.auth_method === 'oauth-google') {
    // Revogar o refresh token invalida também os access tokens emitidos.
    const secret = parseOAuthSecret(await readSecret(db, account.id).catch(() => null));
    const token = secret?.refresh_token ?? secret?.access_token;
    if (token) await revokeGoogleToken(token);
  }
  await deleteMailAccount(db, account);
  return ok();
};

const ACTIONS = [
  'connect-imap',
  'list',
  'get',
  'attachment',
  'send',
  'set-read',
  'set-starred',
  'trash',
  'save-draft',
  'thread',
  'delete-draft',
  'disconnect',
  'discover',
  'share-access',
  'unread-counts',
  'folders',
] as const;
type Action = (typeof ACTIONS)[number];

const handle = async (db: SupabaseClient, userId: string, body: Body): Promise<Response> => {
  const action: Action | undefined = ACTIONS.find(a => a === body.action);
  if (!action) return badRequest();
  if (action === 'connect-imap') return connectImap(db, userId, body);
  if (action === 'share-access') return ok(await shareAccess(db, userId, body.access_id));
  if (action === 'unread-counts') return ok(await unreadCounts(db, userId, createDriver));
  if (action === 'discover') {
    const email = optionalString(body.email, 320);
    return email ? ok(await discoverDomain(domainOfEmail(email), denoResolver)) : badRequest();
  }

  // O segredo lê-se ao mesmo tempo que a conta (menos uma ida à base de dados); só é
  // usado se a conta for mesmo desta pessoa.
  const pendingSecret = isUuid(body.account_id)
    ? readSecret(db, body.account_id)
    : Promise.resolve(null);
  // Sem isto, um erro ao ler o segredo de uma conta que não chega a ser usada ficava por tratar.
  pendingSecret.catch(() => undefined);
  const account = await requireAccount(db, userId, body);
  if (action === 'disconnect') return disconnect(db, account);

  const needsMessage: Action[] = [
    'get',
    'attachment',
    'set-read',
    'set-starred',
    'trash',
    'delete-draft',
  ];
  const messageId = optionalString(body.message_id, 2000) ?? '';
  if (needsMessage.includes(action) && !messageId) return badRequest();

  switch (action) {
    case 'list': {
      const folder = body.folder;
      if (!isMailFolder(folder)) return badRequest();
      const folderId = optionalString(body.folder_id, 1000);
      if (folderId && /[\r\n\0]/.test(folderId)) return badRequest();
      const driver = await createDriver(db, account, pendingSecret);
      try {
        const result = await driver.list({
          folder,
          query: optionalString(body.query, 200),
          pageToken: optionalString(body.page_token, 4000),
          limit: parseListLimit(body.limit),
          folderId,
        });
        await updateAccountStatus(db, account.id, {
          status: 'active',
          last_error: null,
          last_sync_at: new Date().toISOString(),
        });
        return ok(result);
      } catch (error) {
        if (isMailError(error) && error.code === 'provider_error') {
          await updateAccountStatus(db, account.id, { status: 'error', last_error: error.message });
        }
        throw error;
      }
    }
    case 'folders':
      return ok(await (await createDriver(db, account, pendingSecret)).folders());
    case 'get':
      return ok(await (await createDriver(db, account, pendingSecret)).get(messageId));
    case 'attachment': {
      const attachmentId = optionalString(body.attachment_id, 2000);
      if (!attachmentId) return badRequest();
      return ok(
        await (
          await createDriver(db, account, pendingSecret)
        ).attachment(messageId, attachmentId, optionalString(body.filename, 500) ?? null)
      );
    }
    case 'send': {
      const parsed = parseSendRequest(body);
      if (!parsed.ok) {
        return parsed.code === 'bad_request'
          ? badRequest()
          : json({ ok: false, code: parsed.code, message: MAIL_ERROR_MESSAGES[parsed.code] });
      }
      const driver = await createDriver(db, account, pendingSecret);
      return ok(await driver.send(parsed.value));
    }
    case 'save-draft': {
      const parsed = parseSendRequest(body, { draft: true });
      if (!parsed.ok) {
        return parsed.code === 'bad_request'
          ? badRequest()
          : json({ ok: false, code: parsed.code, message: MAIL_ERROR_MESSAGES[parsed.code] });
      }
      const draftId = optionalString(body.draft_id, 2000) ?? null;
      const driver = await createDriver(db, account, pendingSecret);
      return ok(await driver.saveDraft(parsed.value, draftId));
    }
    case 'thread': {
      const threadId = optionalString(body.thread_id, 2000);
      if (!threadId) return badRequest();
      return ok(await (await createDriver(db, account, pendingSecret)).thread(threadId));
    }
    case 'delete-draft':
      await (await createDriver(db, account, pendingSecret)).deleteDraft(messageId);
      return ok();
    case 'set-read':
      if (typeof body.read !== 'boolean') return badRequest();
      await (await createDriver(db, account, pendingSecret)).setRead(messageId, body.read);
      return ok();
    case 'set-starred':
      if (typeof body.starred !== 'boolean') return badRequest();
      await (await createDriver(db, account, pendingSecret)).setStarred(messageId, body.starred);
      return ok();
    case 'trash':
      await (await createDriver(db, account, pendingSecret)).trash(messageId);
      return ok();
    default:
      return badRequest();
  }
};

/** Pedido HTTP → resposta (servido por index.ts, ou pelo servidor local de desenvolvimento). */
export const mailApiHandler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const db = serviceClient();

  // Pedido da própria BD (trigger com pg_net quando um colaborador é associado a um email
  // departamental, em qualquer admin): token de sistema e só esta operação.
  const systemToken = Deno.env.get('MAIL_SYSTEM_TOKEN');
  if (systemToken && req.headers.get('x-mail-system-token') === systemToken) {
    const body: unknown = await req.json().catch(() => null);
    if (isRecord(body) && body.action === 'poll-new')
      return ok(await pollNewMail(db, createDriver));
    if (!isRecord(body) || !isUuid(body.access_id)) return badRequest();
    try {
      return ok(await shareAccessById(db, body.access_id));
    } catch (error) {
      const code = isMailError(error) ? error.code : 'server_error';
      console.error(`mail-api partilha automática ${body.access_id}:`, code, errorMessage(error));
      return json({ ok: false, code });
    }
  }

  const userId = await authenticatedUserId(req, db);
  if (!userId) return json({ ok: false, code: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  if (!isRecord(body)) return badRequest();

  try {
    return await handle(db, userId, body);
  } catch (error) {
    if (isMailError(error)) return json({ ok: false, code: error.code, message: error.message });
    console.error(`mail-api ${String(body.action)}:`, errorMessage(error));
    return json(
      { ok: false, code: 'server_error', message: 'Erro inesperado. Tente novamente.' },
      500
    );
  }
};
