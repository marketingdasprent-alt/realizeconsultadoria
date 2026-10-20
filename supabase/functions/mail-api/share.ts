// Caixas partilhadas pelo admin: um email departamental dos Acessos passa a aparecer no
// Webmail dos colaboradores escolhidos (employee_department_emails). Aqui cria-se (ou
// atualiza-se) a conta única do acesso, com os servidores descobertos por DNS e o login
// testado; os membros e as mudanças de palavra-passe seguem depois por triggers na BD.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { discoverDomain, domainOfEmail } from '../_shared/mail/discover.ts';
import { mailError } from '../_shared/mail/errors.ts';
import { isUuid } from '../_shared/mail/request.ts';
import { GRAPH_BASE } from '../_shared/mail/folders.ts';
import { storeSecret } from '../_shared/mail-server/accounts.ts';
import { denoResolver } from '../_shared/mail-server/dns.ts';
import { fetchWithTimeout } from '../_shared/mail-server/http.ts';
import { MailAppError, microsoftAppToken } from '../_shared/mail-server/oauth-client.ts';
import { testImapLogin } from './drivers/imap.ts';

const SMTP_SSL_PORT = 465;

interface AccessRow {
  id: string;
  company_id: string;
  title: string;
  username: string;
  password: string;
}

interface SharedAccountRow {
  id: string;
  auth_method: string;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
}

const isAdmin = async (db: SupabaseClient, userId: string) => {
  const { data, error } = await db.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error) throw error;
  return data === true;
};

/** Cria a conta partilhada e junta os colaboradores do acesso. */
const saveShared = async (
  db: SupabaseClient,
  row: AccessRow,
  accountId: string | null,
  fields: Record<string, unknown>
): Promise<string> => {
  if (accountId) {
    const { error } = await db.from('mail_accounts').update(fields).eq('id', accountId);
    if (error) throw error;
    return accountId;
  }
  const { data, error } = await db
    .from('mail_accounts')
    .insert({ ...fields, access_id: row.id, user_id: null, is_default: false })
    .select('id')
    .single();
  // A BD (trigger) e o ecrã pedem a mesma caixa ao mesmo tempo: quem chega em segundo
  // encontra a conta já criada (access_id é único) e só a atualiza.
  if (error && (error as { code?: string }).code === '23505') {
    const { data: existing, error: findError } = await db
      .from('mail_accounts')
      .select('id')
      .eq('access_id', row.id)
      .single();
    if (findError) throw findError;
    const id = (existing as { id: string }).id;
    const { error: updateError } = await db.from('mail_accounts').update(fields).eq('id', id);
    if (updateError) throw updateError;
    return id;
  }
  if (error) throw error;
  return (data as { id: string }).id;
};

const syncMembers = async (db: SupabaseClient, accessId: string, accountId: string) => {
  const { error } = await db.rpc('mail_sync_access_members', { p_access: accessId });
  if (error) throw error;
  const { count } = await db
    .from('mail_account_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  return count ?? 0;
};

/**
 * Caixa do Microsoft 365: lida e enviada com a permissão da própria app "Realize Webmail"
 * (Mail.ReadWrite e Mail.Send de aplicação, com consentimento do administrador). A
 * palavra-passe do acesso não é usada; confirma-se só que a app consegue abrir a caixa.
 */
const shareMicrosoftApp = async (
  db: SupabaseClient,
  row: AccessRow,
  email: string,
  accountId: string | null
) => {
  let token: string;
  try {
    token = (await microsoftAppToken(domainOfEmail(email))).access_token;
  } catch (error) {
    const code = error instanceof MailAppError ? error.code : 'erro';
    throw mailError(
      'provider_error',
      code === 'not_configured'
        ? 'A ligação à Microsoft não está configurada.'
        : 'A app Realize não tem acesso a esta organização Microsoft. Confirme as permissões de aplicação e o consentimento do administrador.'
    );
  }
  const res = await fetchWithTimeout(
    `${GRAPH_BASE}/users/${encodeURIComponent(email)}/mailFolders/inbox?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => null);
  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    await res?.body?.cancel();
    throw mailError(
      'provider_error',
      status === 404
        ? 'Esta caixa não existe no Microsoft 365.'
        : status === 401 || status === 403
          ? 'A app Realize ainda não tem permissão para ler caixas (Mail.ReadWrite de aplicação com consentimento do administrador).'
          : 'Não foi possível abrir a caixa no Microsoft 365.'
    );
  }
  await res.body?.cancel();

  const id = await saveShared(db, row, accountId, {
    provider: 'office365',
    auth_method: 'app-microsoft',
    email,
    display_name: row.title.trim().slice(0, 120) || null,
    company_id: row.company_id,
    imap_host: null,
    imap_port: null,
    smtp_host: null,
    smtp_port: null,
    status: 'active',
    last_error: null,
  });
  return { account_id: id, email, members: await syncMembers(db, row.id, id), servers: null };
};

/** Pedido de um admin (ecrã de Acessos do Realize 2.0). */
export const shareAccess = async (db: SupabaseClient, userId: string, accessId: unknown) => {
  if (!isUuid(accessId)) throw mailError('bad_request');
  if (!(await isAdmin(db, userId))) throw mailError('forbidden');
  return shareAccessById(db, accessId);
};

/**
 * Cria ou atualiza a caixa partilhada de um acesso. Também chamado pela própria BD
 * (trigger com pg_net) quando um colaborador é associado em qualquer admin.
 */
export const shareAccessById = async (db: SupabaseClient, accessId: string) => {
  const { data: access, error } = await db
    .from('accesses')
    .select('id, company_id, title, username, password')
    .eq('id', accessId)
    .maybeSingle();
  if (error) throw error;
  if (!access) throw mailError('not_found', 'Acesso não encontrado.');
  const row = access as AccessRow;
  const email = row.username.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw mailError('bad_request', 'O utilizador deste acesso não é um endereço de email.');

  const { data: existing, error: existingError } = await db
    .from('mail_accounts')
    .select('id, auth_method, imap_host, imap_port, smtp_host, smtp_port')
    .eq('access_id', row.id)
    .maybeSingle();
  if (existingError) throw existingError;
  const current = existing as SharedAccountRow | null;
  if (current?.auth_method === 'app-microsoft')
    return shareMicrosoftApp(db, row, email, current.id);

  // Servidores: os que a caixa já tem ou, da primeira vez, descobertos pelo domínio.
  let servers =
    current?.imap_host && current.imap_port && current.smtp_host && current.smtp_port
      ? {
          imapHost: current.imap_host,
          imapPort: current.imap_port,
          smtpHost: current.smtp_host,
          smtpPort: current.smtp_port,
        }
      : null;
  if (!servers) {
    const discovery = await discoverDomain(domainOfEmail(email), denoResolver);
    // Microsoft 365 já não aceita palavra-passe por IMAP: usa-se a permissão da app.
    if (discovery?.oauth === 'office365')
      return shareMicrosoftApp(db, row, email, current?.id ?? null);
    if (discovery?.oauth) throw mailError('oauth_domain');
    servers = discovery?.servers ?? null;
  }
  if (!servers) throw mailError('imap_login_failed', 'Não foi possível descobrir os servidores.');
  if (servers.smtpPort !== SMTP_SSL_PORT) throw mailError('smtp_port_blocked');

  await testImapLogin({
    email,
    displayName: row.title,
    username: email,
    password: row.password,
    ...servers,
  });

  const fields = {
    provider: 'imap',
    auth_method: 'imap',
    email,
    display_name: row.title.trim().slice(0, 120) || null,
    company_id: row.company_id,
    imap_host: servers.imapHost,
    imap_port: servers.imapPort,
    smtp_host: servers.smtpHost,
    smtp_port: servers.smtpPort,
    status: 'active',
    last_error: null,
  };
  const accountId = await saveShared(db, row, current?.id ?? null, fields);
  await storeSecret(db, accountId, { username: email, password: row.password });
  return {
    account_id: accountId,
    email,
    members: await syncMembers(db, row.id, accountId),
    servers,
  };
};
