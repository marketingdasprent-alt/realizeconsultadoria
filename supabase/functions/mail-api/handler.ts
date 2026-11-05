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
import type { MailDriver, MailListParams } from '../_shared/mail/types.ts';
import {
  ACCOUNT_COLUMNS,
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
import { embedSignatureImages } from '../_shared/mail-server/inline-images.ts';
import { createGmailDriver } from './drivers/gmail.ts';
import { createGraphDriver } from './drivers/graph.ts';
import { createImapDriver, testImapLogin, type ImapAccountConfig } from './drivers/imap.ts';
import { pollNewMail } from './poll.ts';
import {
  MAX_LABELS_PER_ACCOUNT,
  applyLabel,
  attachLabels,
  cleanAutomation,
  isLabelColor,
  labelCounts,
  markForwarded,
  listLabels,
  listWithLabel,
} from './labels.ts';
import { dropFolderRefs, renameFolderRefs } from './folderRefs.ts';
import { fetchRemoteAttachments, parseRemoteAttachments } from './remoteAttachments.ts';
import { bundleIfTooMany } from './bundleAttachments.ts';
import { inBackground, readCached, writeCached } from './messageCache.ts';
import { patchCachedLists, preloadBodies, readCachedList, writeCachedList } from './listCache.ts';
import { MAX_RULES_PER_ACCOUNT, applyRules, listRules } from './rules.ts';
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

/** Tempos (ms) de abrir o primeiro email da Entrada: driver, lista, abrir a frio e outra vez. */
const probeOpen = async (db: SupabaseClient, accountId: string) => {
  const { data } = await db
    .from('mail_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', accountId)
    .maybeSingle();
  const account = data as MailAccountRow | null;
  if (!account) return { found: false };
  const times: Record<string, number> = {};
  const time = async <T>(name: string, run: () => Promise<T>) => {
    const started = Date.now();
    try {
      return await run();
    } finally {
      times[name] = Date.now() - started;
    }
  };
  try {
    const driver = await time('driver', () => createDriver(db, account));
    const list = await time('list', () =>
      driver.list({ folder: 'inbox', query: null, pageToken: null, limit: 25 })
    );
    const first = list.messages[0];
    if (first) {
      await time('get_first', () => driver.get(first.id));
      await time('get_again', () => driver.get(first.id));
    }
    return { found: true, provider: account.auth_method, times, messages: list.messages.length };
  } catch (error) {
    return { found: true, provider: account.auth_method, times, error: errorMessage(error) };
  }
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
  'create-folder',
  'rename-folder',
  'delete-folder',
  'move',
  'rules',
  'rule-save',
  'rule-delete',
  'rule-run',
  'labels',
  'label-counts',
  'label-save',
  'label-delete',
  'label-apply',
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
    'move',
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
      const params = {
        folder,
        query: optionalString(body.query, 200),
        pageToken: optionalString(body.page_token, 4000),
        limit: parseListLimit(body.limit),
        folderId,
      };
      try {
        // Uma falha de ligação passageira (ex.: servidor partilhado a recusar várias ligações
        // ao mesmo tempo) tenta-se outra vez antes de desistir.
        const listPage = (page: MailListParams) =>
          driver.list(page).catch(async error => {
            if (!isMailError(error) || error.code !== 'provider_error') throw error;
            await new Promise(resolve => setTimeout(resolve, 1500));
            return driver.list(page);
          });
        // Caixas IMAP, primeira página sem pesquisa nem marcador: mostra já a lista guardada e
        // vai buscar a nova em fundo (como o Outlook); os primeiros emails ficam já guardados.
        const cacheable =
          account.auth_method === 'imap' &&
          !params.query &&
          !params.pageToken &&
          !isUuid(body.label_id);
        const folderKey = `${folder}|${folderId ?? ''}|${params.limit}`;
        if (cacheable) {
          const cached = await readCachedList(db, account.id, folderKey);
          if (cached) {
            inBackground(
              (async () => {
                const fresh = await listPage(params);
                await writeCachedList(db, account.id, folderKey, fresh);
                await preloadBodies(db, account.id, driver, fresh.messages);
              })()
            );
            return ok({ ...cached, messages: await attachLabels(db, account.id, cached.messages) });
          }
        }
        // Com um marcador escolhido, só vêm os emails da pasta que o têm
        const result = isUuid(body.label_id)
          ? await listWithLabel(db, account.id, body.label_id, params, listPage)
          : await listPage(params);
        if (cacheable)
          inBackground(
            (async () => {
              await writeCachedList(db, account.id, folderKey, result);
              await preloadBodies(db, account.id, driver, result.messages);
            })()
          );
        await updateAccountStatus(db, account.id, {
          status: 'active',
          last_error: null,
          last_sync_at: new Date().toISOString(),
        });
        return ok({
          ...result,
          messages: await attachLabels(db, account.id, result.messages),
        });
      } catch (error) {
        if (isMailError(error) && error.code === 'provider_error') {
          // Só fica "com erro" (o ⚠️) se a caixa não sincroniza há mais de 30 minutos; uma falha
          // isolada fica só registada, sem alarmar quem usa a caixa.
          const { data: row } = await db
            .from('mail_accounts')
            .select('last_sync_at')
            .eq('id', account.id)
            .maybeSingle();
          const lastSync = row?.last_sync_at ? Date.parse(row.last_sync_at) : 0;
          const stuck = !lastSync || Date.now() - lastSync > 30 * 60_000;
          await updateAccountStatus(db, account.id, {
            ...(stuck ? { status: 'error' as const } : {}),
            last_error: error.message,
          });
        }
        throw error;
      }
    }
    case 'folders':
      return ok(await (await createDriver(db, account, pendingSecret)).folders());
    case 'create-folder': {
      const name = optionalString(body.name, 100)?.trim();
      const parentId = optionalString(body.parent_id, 1000) ?? null;
      // Sem separadores nem caracteres de controlo: o nome é só uma pasta, nunca um caminho
      if (!name || /[\\/.\r\n\0]/.test(name) || (parentId && /[\r\n\0]/.test(parentId)))
        return badRequest();
      return ok(
        await (await createDriver(db, account, pendingSecret)).createFolder(name, parentId)
      );
    }
    case 'rename-folder': {
      const folderId = optionalString(body.folder_id, 1000);
      const name = optionalString(body.name, 100)?.trim();
      if (!folderId || /[\r\n\0]/.test(folderId) || !name || /[\\/.\r\n\0]/.test(name))
        return badRequest();
      const renamed = await (
        await createDriver(db, account, pendingSecret)
      ).renameFolder(folderId, name);
      await renameFolderRefs(db, account.id, folderId, renamed.id, name, renamed.moved);
      return ok({ id: renamed.id });
    }
    case 'delete-folder': {
      const folderId = optionalString(body.folder_id, 1000);
      if (!folderId || /[\r\n\0]/.test(folderId)) return badRequest();
      const { removed } = await (
        await createDriver(db, account, pendingSecret)
      ).deleteFolder(folderId);
      await dropFolderRefs(db, account.id, removed);
      return ok({ removed: removed.length });
    }
    case 'rules':
      return ok(await listRules(db, account.id));
    case 'rule-save': {
      const text = (value: unknown, max: number) => optionalString(value, max)?.trim() || null;
      const fromContains = text(body.from_contains, 200);
      const keyword = text(body.keyword, 200);
      const folderId = text(body.folder_id, 1000);
      const folderName = text(body.folder_name, 200);
      const knownLabels = new Set((await listLabels(db, account.id)).map(label => label.id));
      const labelIds = [
        ...new Set(
          (Array.isArray(body.label_ids) ? body.label_ids : []).filter(
            (id): id is string => isUuid(id) && knownLabels.has(id)
          )
        ),
      ].slice(0, 10);
      // Pelo menos uma ação: pasta e/ou marcadores
      if ((!fromContains && !keyword) || (!folderId && !labelIds.length)) return badRequest();
      if (folderId) {
        if (!folderName || /[\r\n\0]/.test(folderId)) return badRequest();
        const driver = await createDriver(db, account, pendingSecret);
        // A pasta tem de existir mesmo nesta caixa
        if (!(await driver.folders()).some(folder => folder.id === folderId)) return badRequest();
      }
      const row = {
        name: text(body.name, 100) ?? '',
        from_contains: fromContains,
        keyword,
        folder_id: folderId,
        folder_name: folderId ? folderName : null,
        label_ids: labelIds,
        mark_read: body.mark_read === true,
        is_active: body.is_active !== false,
        last_error: null,
      };
      const ruleId = isUuid(body.rule_id) ? body.rule_id : null;
      if (ruleId) {
        const { data, error } = await db
          .from('mail_rules')
          .update(row)
          .eq('id', ruleId)
          .eq('account_id', account.id)
          .select('id');
        if (error) throw error;
        return (data ?? []).length ? ok({ id: ruleId }) : badRequest();
      }
      if ((await listRules(db, account.id)).length >= MAX_RULES_PER_ACCOUNT)
        return json({
          ok: false,
          code: 'bad_request',
          message: 'Esta caixa já tem o máximo de regras (' + MAX_RULES_PER_ACCOUNT + ').',
        });
      const { data, error } = await db
        .from('mail_rules')
        .insert({ ...row, account_id: account.id, created_by: userId })
        .select('id')
        .single();
      if (error) throw error;
      return ok({ id: data.id });
    }
    case 'rule-delete': {
      if (!isUuid(body.rule_id)) return badRequest();
      const { error } = await db
        .from('mail_rules')
        .delete()
        .eq('id', body.rule_id)
        .eq('account_id', account.id);
      if (error) throw error;
      return ok();
    }
    case 'rule-run': {
      // Aplica uma regra aos emails que já estão na Entrada (ao criá-la)
      if (!isUuid(body.rule_id)) return badRequest();
      const rules = (await listRules(db, account.id)).filter(rule => rule.id === body.rule_id);
      if (!rules.length) return badRequest();
      const driver = await createDriver(db, account, pendingSecret);
      const result = await applyRules(db, driver, rules, true);
      return ok({ moved: result.count });
    }
    case 'labels':
      return ok(await listLabels(db, account.id));
    case 'label-counts':
      return ok(await labelCounts(db, account.id));
    case 'label-save': {
      const name = optionalString(body.name, 40)?.trim();
      if (!name || !isLabelColor(body.color)) return badRequest();
      const all = await listLabels(db, account.id);
      const labelId = isUuid(body.label_id) ? body.label_id : null;
      if (!labelId && all.length >= MAX_LABELS_PER_ACCOUNT)
        return json({
          ok: false,
          code: 'bad_request',
          message: 'Esta caixa já tem o máximo de marcadores (' + MAX_LABELS_PER_ACCOUNT + ').',
        });
      // Um marcador não se tira a si próprio
      const others = new Set(all.filter(label => label.id !== labelId).map(label => label.id));
      const automation = cleanAutomation(body.on_apply, others);
      if (automation.folder_id) {
        const folders = await (await createDriver(db, account, pendingSecret)).folders();
        if (!folders.some(folder => folder.id === automation.folder_id)) {
          delete automation.folder_id;
          delete automation.folder_name;
        }
      }
      const row = { name, color: body.color, on_apply: automation };
      const duplicate = () =>
        json({
          ok: false,
          code: 'bad_request',
          message: 'Já existe um marcador com esse nome.',
        });
      if (labelId) {
        const { data, error } = await db
          .from('mail_labels')
          .update(row)
          .eq('id', labelId)
          .eq('account_id', account.id)
          .select('id');
        if (error?.code === '23505') return duplicate();
        if (error) throw error;
        return (data ?? []).length ? ok({ id: labelId }) : badRequest();
      }
      const { data, error } = await db
        .from('mail_labels')
        .insert({ ...row, account_id: account.id, created_by: userId })
        .select('id')
        .single();
      if (error?.code === '23505') return duplicate();
      if (error) throw error;
      return ok({ id: data.id });
    }
    case 'label-delete': {
      if (!isUuid(body.label_id)) return badRequest();
      const { error } = await db
        .from('mail_labels')
        .delete()
        .eq('id', body.label_id)
        .eq('account_id', account.id);
      if (error) throw error;
      return ok();
    }
    case 'label-apply': {
      if (!isUuid(body.label_id) || !Array.isArray(body.items) || body.items.length > 100)
        return badRequest();
      const items = body.items.flatMap((raw: unknown) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const id = optionalString(item.id, 2000);
        const key = optionalString(item.key, 600);
        return id && key ? [{ id, key }] : [];
      });
      const label = (await listLabels(db, account.id)).find(item => item.id === body.label_id);
      if (!label) return badRequest();
      const driver = await createDriver(db, account, pendingSecret);
      const result = await applyLabel(
        db,
        driver,
        account.id,
        label,
        items,
        body.on === true,
        userId
      );
      return ok({ moved: [...result.moved], error: result.error });
    }
    case 'move': {
      const folderId = optionalString(body.folder_id, 1000);
      if (!folderId || /[\r\n\0]/.test(folderId)) return badRequest();
      await (await createDriver(db, account, pendingSecret)).move(messageId, folderId);
      if (account.auth_method === 'imap')
        inBackground(patchCachedLists(db, account.id, messageId, null));
      return ok();
    }
    case 'get': {
      // Caixas IMAP (alojamento lento): abre da cópia local, se houver; senão do servidor e
      // guarda a cópia para a próxima vez (depois de responder)
      const imap = account.auth_method === 'imap';
      const cached = imap ? await readCached(db, account.id, messageId) : null;
      if (cached) return ok((await attachLabels(db, account.id, [cached]))[0]);
      const message = await (await createDriver(db, account, pendingSecret)).get(messageId);
      if (imap) inBackground(writeCached(db, account.id, message));
      return ok((await attachLabels(db, account.id, [message]))[0]);
    }
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
        console.warn(
          'mail-api send: pedido recusado',
          parsed.code,
          `anexos=${Array.isArray(body.attachments) ? body.attachments.length : typeof body.attachments}`
        );
        return parsed.code === 'bad_request'
          ? badRequest()
          : json({ ok: false, code: parsed.code, message: MAIL_ERROR_MESSAGES[parsed.code] });
      }
      const driver = await createDriver(db, account, pendingSecret);
      // Reencaminhar: os anexos do original vêm da caixa dele (sem passar pelo browser)
      const remote = parseRemoteAttachments(body.remote_attachments);
      if (body.remote_attachments && !remote) {
        const raw = body.remote_attachments as Record<string, unknown>;
        const items = Array.isArray(raw?.items) ? (raw.items as Record<string, unknown>[]) : [];
        console.warn(
          'mail-api send: anexos do original recusados',
          `conta=${isUuid(raw?.account_id)}`,
          `msg=${typeof raw?.message_id}:${String(raw?.message_id ?? '').length}`,
          `itens=${items.length}`,
          `ids=${items
            .slice(0, 3)
            .map(item => `${typeof item?.id}:${String(item?.id ?? '').length}`)
            .join(',')}`
        );
        return json({
          ok: false,
          code: 'bad_request',
          message: 'Não foi possível juntar os anexos do email original (pedido inválido).',
        });
      }
      if (remote) {
        const source =
          remote.accountId === account.id
            ? driver
            : await createDriver(
                db,
                await requireAccount(db, userId, { account_id: remote.accountId }),
                readSecret(db, remote.accountId)
              );
        const already =
          parsed.value.attachmentBytes.reduce((total, item) => total + item.length, 0) +
          parsed.value.html.length +
          parsed.value.text.length;
        const extra = await fetchRemoteAttachments(
          source,
          remote,
          already,
          account.auth_method !== 'imap'
        );
        parsed.value.attachments.push(...extra.attachments);
        parsed.value.attachmentBytes.push(...extra.bytes);
      }
      // Mais de 90 anexos: vão num anexos.zip (muitos servidores recusam 100+ partes MIME)
      const bundled = bundleIfTooMany(parsed.value.attachments, parsed.value.attachmentBytes);
      parsed.value.attachments = bundled.attachments;
      parsed.value.attachmentBytes = bundled.attachmentBytes;
      // Imagens da assinatura dentro do email (o Outlook bloqueia as que vêm por link)
      const embedded = await embedSignatureImages(parsed.value.html);
      const sent = await driver.send({ ...parsed.value, ...embedded });
      // Reencaminhar: o email original fica com a marca "reencaminhado"
      const forwardKey = optionalString(body.forward_of_key, 1000);
      if (forwardKey && !/[\r\n\0]/.test(forwardKey))
        await markForwarded(db, account.id, forwardKey, userId);
      return ok(sent);
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
      if (account.auth_method === 'imap')
        inBackground(patchCachedLists(db, account.id, messageId, { unread: !body.read }));
      return ok();
    case 'set-starred':
      if (typeof body.starred !== 'boolean') return badRequest();
      await (await createDriver(db, account, pendingSecret)).setStarred(messageId, body.starred);
      if (account.auth_method === 'imap')
        inBackground(patchCachedLists(db, account.id, messageId, { starred: body.starred }));
      return ok();
    case 'trash':
      await (await createDriver(db, account, pendingSecret)).trash(messageId);
      if (account.auth_method === 'imap')
        inBackground(patchCachedLists(db, account.id, messageId, null));
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
    if (isRecord(body) && body.action === 'poll-new') {
      const started = Date.now();
      const result = await pollNewMail(db, createDriver);
      logIfSlow('poll-new', '-', started);
      return ok(result);
    }
    // Diagnóstico da lentidão ao abrir emails: cronometra cada passo numa caixa (sem conteúdo).
    if (isRecord(body) && body.action === 'probe-open' && isUuid(body.account_id))
      return ok(await probeOpen(db, body.account_id));
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

  const started = Date.now();
  try {
    return await handle(db, userId, body);
  } catch (error) {
    if (isMailError(error)) {
      // Envios e rascunhos que falham ficam no registo (com o motivo), para se ver logo o porquê
      if (body.action === 'send' || body.action === 'save-draft')
        console.warn(
          `mail-api ${String(body.action)} falhou: conta=${String(body.account_id)}`,
          error.code,
          error.message
        );
      return json({ ok: false, code: error.code, message: error.message });
    }
    console.error(`mail-api ${String(body.action)}:`, errorMessage(error));
    return json(
      { ok: false, code: 'server_error', message: 'Erro inesperado. Tente novamente.' },
      500
    );
  } finally {
    logIfSlow(String(body.action), String(body.account_id ?? '-'), started);
  }
};

/** Pedidos lentos (mais de 5 s) ficam no registo com a ação e a caixa, para se ver o que pesa. */
const logIfSlow = (action: string, accountId: string, started: number) => {
  const ms = Date.now() - started;
  if (ms > 5000) console.warn(`mail-api lento: ${action} conta=${accountId} ${ms}ms`);
};
