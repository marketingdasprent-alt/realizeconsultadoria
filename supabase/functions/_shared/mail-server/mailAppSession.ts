// App de email para clientes de fora (mail.realizeconsultadoria.pt): a caixa de email é a conta.
// Cada caixa tem uma conta interna só de email (app_metadata.mail_only → o login dá-lhe o papel
// mail_client, que só chega às tabelas do email). O endereço desta conta é inventado a partir
// da caixa — nunca é a conta da Realize de quem tenha o mesmo email.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Origem da app de email (regresso da Microsoft e ligações dos avisos). */
export const MAIL_APP_ORIGIN = 'https://mail.realizeconsultadoria.pt';

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Conta interna (só de email) da caixa: a que já existe, ou uma nova. */
export const mailAppUser = async (
  db: SupabaseClient,
  mailbox: string,
  displayName: string | null
): Promise<string> => {
  const key = mailbox.trim().toLowerCase();
  const { data: existing } = await db
    .from('mail_app_users')
    .select('user_id')
    .eq('mailbox', key)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id as string;

  const email = `m-${(await sha256Hex(key)).slice(0, 32)}@clientes.mail.realizeconsultadoria.pt`;
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { mail_only: true, mailbox: key },
    user_metadata: { name: displayName ?? key },
  });
  let userId = created?.user?.id ?? null;
  if (error || !userId) {
    // Já criada (pedido em paralelo, ou mapa perdido): procura pelo endereço inventado
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find(u => u.email === email)?.id ?? null;
    if (!userId) throw error ?? new Error('Conta da caixa não criada');
  }
  await db
    .from('mail_app_users')
    .upsert({ mailbox: key, user_id: userId }, { onConflict: 'mailbox' });
  return userId;
};

/** Sessão para a conta interna (o servidor gera e confirma um link mágico, sem enviar email). */
export const mailAppSession = async (
  db: SupabaseClient,
  userId: string
): Promise<{ access_token: string; refresh_token: string }> => {
  const { data: user, error: userError } = await db.auth.admin.getUserById(userId);
  const email = user?.user?.email;
  if (userError || !email || user.user.app_metadata?.mail_only !== true)
    throw new Error('Conta da caixa inválida');
  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) throw error ?? new Error('Sem link de entrada');
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  const session = verified?.session;
  if (verifyError || !session) throw verifyError ?? new Error('Sessão não criada');
  await db
    .from('mail_app_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('user_id', userId);
  return { access_token: session.access_token, refresh_token: session.refresh_token };
};

/** Código de uma só utilização (2 min) para o regresso da Microsoft trocar pela sessão. */
export const createLoginCode = async (db: SupabaseClient, userId: string): Promise<string> => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const code = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const { error } = await db.from('mail_login_codes').insert({ code, user_id: userId });
  if (error) throw error;
  return code;
};

/** Troca o código pela conta (apaga-o: só serve uma vez). */
export const consumeLoginCode = async (db: SupabaseClient, code: string): Promise<string | null> => {
  if (!code || code.length > 100) return null;
  const { data } = await db
    .from('mail_login_codes')
    .delete()
    .eq('code', code)
    .select('user_id, created_at')
    .maybeSingle();
  if (!data) return null;
  if (Date.now() - Date.parse(data.created_at as string) > 2 * 60_000) return null;
  return data.user_id as string;
};
