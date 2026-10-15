// Contas de email (mail_accounts) e segredos no Vault (mail_secret_set/get, mail_account_delete).
// Tudo com o cliente service role; os segredos nunca saem das edge functions.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailAuthMethod, MailProviderKey } from '../mail/types.ts';

export interface MailAccountRow {
  id: string;
  /** null nas caixas partilhadas (ligadas a um acesso do admin). */
  user_id: string | null;
  access_id: string | null;
  company_id: string | null;
  provider: MailProviderKey;
  auth_method: MailAuthMethod;
  email: string;
  display_name: string | null;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  status: 'active' | 'error' | 'reauth';
  is_default: boolean;
}

export const ACCOUNT_COLUMNS =
  'id, user_id, access_id, company_id, provider, auth_method, email, display_name, imap_host, imap_port, smtp_host, smtp_port, status, is_default';

/** Conta do próprio utilizador ou partilhada com ele pelo admin (nunca de outro). */
export const loadAccount = async (
  db: SupabaseClient,
  accountId: string,
  userId: string
): Promise<MailAccountRow | null> => {
  const { data, error } = await db
    .from('mail_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  const account = (data as MailAccountRow | null) ?? null;
  if (!account || account.user_id === userId) return account;
  const { data: member, error: memberError } = await db
    .from('mail_account_members')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) throw memberError;
  return member ? account : null;
};

/** Empresa do colaborador ativo (null para quem não é colaborador, ex. admins). */
const activeCompanyId = async (db: SupabaseClient, userId: string): Promise<string | null> => {
  const { data } = await db
    .from('employees')
    .select('company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return (data?.company_id as string | null | undefined) ?? null;
};

export interface SaveAccountInput {
  userId: string;
  provider: MailProviderKey;
  authMethod: MailAuthMethod;
  email: string;
  displayName: string | null;
  /** Nome escolhido pelo utilizador (IMAP) substitui o atual; o do fornecedor (OAuth) não. */
  overrideDisplayName?: boolean;
  server?: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number };
}

/**
 * Cria ou atualiza a conta (user_id, email). A primeira conta do utilizador fica como
 * predefinida; numa religação mantém-se nome, assinatura, cor e predefinição.
 */
export const saveMailAccount = async (
  db: SupabaseClient,
  input: SaveAccountInput
): Promise<{ id: string; existed: boolean }> => {
  const email = input.email.trim().toLowerCase();
  // A BD limita display_name a 120 caracteres.
  const displayName = input.displayName?.trim().slice(0, 120) || null;
  const companyId = await activeCompanyId(db, input.userId);
  const fields: Record<string, unknown> = {
    provider: input.provider,
    auth_method: input.authMethod,
    company_id: companyId,
    status: 'active',
    last_error: null,
    updated_at: new Date().toISOString(),
    imap_host: input.server?.imapHost ?? null,
    imap_port: input.server?.imapPort ?? null,
    smtp_host: input.server?.smtpHost ?? null,
    smtp_port: input.server?.smtpPort ?? null,
  };

  const findExisting = async () => {
    const { data, error } = await db
      .from('mail_accounts')
      .select('id, display_name')
      .eq('user_id', input.userId)
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; display_name: string | null } | null;
  };

  const update = async (existing: { id: string; display_name: string | null }) => {
    const patch = { ...fields };
    if (displayName && (input.overrideDisplayName || !existing.display_name)) {
      patch.display_name = displayName;
    }
    const { error } = await db.from('mail_accounts').update(patch).eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, existed: true };
  };

  const existing = await findExisting();
  if (existing) return update(existing);

  const { count } = await db
    .from('mail_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId);
  const { data, error } = await db
    .from('mail_accounts')
    .insert({
      ...fields,
      user_id: input.userId,
      email,
      display_name: displayName,
      is_default: (count ?? 0) === 0,
    })
    .select('id')
    .single();
  if (error) {
    // Dois pedidos em simultâneo para a mesma caixa: o outro já a criou.
    if (error.code === '23505') {
      const raced = await findExisting();
      if (raced) return update(raced);
    }
    throw error;
  }
  return { id: (data as { id: string }).id, existed: false };
};

export const storeSecret = async (
  db: SupabaseClient,
  accountId: string,
  secret: object
): Promise<void> => {
  const { error } = await db.rpc('mail_secret_set', {
    p_account: accountId,
    p_secret: JSON.stringify(secret),
  });
  if (error) throw error;
};

export const readSecret = async (db: SupabaseClient, accountId: string): Promise<string | null> => {
  const { data, error } = await db.rpc('mail_secret_get', { p_account: accountId });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
};

export const updateAccountStatus = async (
  db: SupabaseClient,
  accountId: string,
  patch: {
    status?: MailAccountRow['status'];
    last_error?: string | null;
    last_sync_at?: string;
  }
): Promise<void> => {
  const { error } = await db
    .from('mail_accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', accountId);
  if (error) console.error('mail: falha ao atualizar o estado da conta', error.message);
};

/** Apaga conta + segredo; se era a predefinida, passa a predefinida a mais recente. */
export const deleteMailAccount = async (
  db: SupabaseClient,
  account: MailAccountRow
): Promise<void> => {
  const { error } = await db.rpc('mail_account_delete', { p_account: account.id });
  if (error) throw error;
  if (!account.is_default) return;
  const { data: next } = await db
    .from('mail_accounts')
    .select('id')
    .eq('user_id', account.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (next) await db.from('mail_accounts').update({ is_default: true }).eq('id', next.id);
};
