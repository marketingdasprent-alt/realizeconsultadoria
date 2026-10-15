// Caixas partilhadas pelo admin: um email departamental dos Acessos passa a aparecer no
// Webmail dos colaboradores escolhidos (employee_department_emails). Aqui cria-se (ou
// atualiza-se) a conta única do acesso, com os servidores descobertos por DNS e o login
// testado; os membros e as mudanças de palavra-passe seguem depois por triggers na BD.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { discoverDomain, domainOfEmail } from '../_shared/mail/discover.ts';
import { mailError } from '../_shared/mail/errors.ts';
import { isUuid } from '../_shared/mail/request.ts';
import { storeSecret } from '../_shared/mail-server/accounts.ts';
import { denoResolver } from '../_shared/mail-server/dns.ts';
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
    .select('id, imap_host, imap_port, smtp_host, smtp_port')
    .eq('access_id', row.id)
    .maybeSingle();
  if (existingError) throw existingError;
  const current = existing as SharedAccountRow | null;

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
  let accountId = current?.id ?? null;
  if (accountId) {
    const { error: updateError } = await db
      .from('mail_accounts')
      .update(fields)
      .eq('id', accountId);
    if (updateError) throw updateError;
  } else {
    const { data: created, error: insertError } = await db
      .from('mail_accounts')
      .insert({ ...fields, access_id: row.id, user_id: null, is_default: false })
      .select('id')
      .single();
    if (insertError) throw insertError;
    accountId = (created as { id: string }).id;
  }
  await storeSecret(db, accountId, { username: email, password: row.password });

  const { error: syncError } = await db.rpc('mail_sync_access_members', { p_access: row.id });
  if (syncError) throw syncError;
  const { count } = await db
    .from('mail_account_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('account_id', accountId);

  return { account_id: accountId, email, members: count ?? 0, servers };
};
