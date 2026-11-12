// App de email para clientes de fora (mail.realizeconsultadoria.pt): entrar com a própria caixa
// (função mail-login). Devolve a sessão de uma conta interna só de email.
import { supabase } from '@/integrations/supabase/client';
import type { Discovery } from '../lib/autodiscover';
import type { ImapConnectInput } from '../types';

interface LoginResult {
  ok: boolean;
  code?: string;
  message?: string;
  data?: { access_token: string; refresh_token: string; url?: string };
}

const call = async (body: Record<string, unknown>): Promise<LoginResult> => {
  const { data, error } = await supabase.functions.invoke('mail-login', { body });
  if (error || !data)
    return { ok: false, code: 'unavailable', message: 'Sem ligação ao servidor.' };
  return data as LoginResult;
};

const startSession = async (result: LoginResult): Promise<string | null> => {
  if (!result.ok || !result.data?.access_token)
    return result.message || 'Não foi possível entrar. Confirme os dados e tente outra vez.';
  const { error } = await supabase.auth.setSession({
    access_token: result.data.access_token,
    refresh_token: result.data.refresh_token,
  });
  return error ? 'A sessão não abriu. Tente outra vez.' : null;
};

/** Servidores IMAP/SMTP do domínio (sem sessão). */
export const mailAppDiscover = async (email: string): Promise<Discovery | null> => {
  const result = (await call({ action: 'discover', email })) as LoginResult & { data?: Discovery };
  return result.ok ? ((result.data as unknown as Discovery) ?? null) : null;
};

/** Entrar com IMAP: null se entrou, senão a mensagem de erro. */
export const mailAppLoginImap = async (input: ImapConnectInput) =>
  startSession(
    await call({
      action: 'imap',
      provider: input.provider,
      email: input.email,
      password: input.password,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      display_name: input.displayName,
    })
  );

/** Entrar com a Microsoft: vai para a página da Microsoft (volta com ?login=…). */
export const mailAppLoginMicrosoft = async (provider: string): Promise<string | null> => {
  const result = await call({ action: 'oauth-start', provider });
  const url = (result.data as { url?: string } | undefined)?.url;
  if (!result.ok || !url) return result.message || 'A Microsoft não respondeu. Tente outra vez.';
  window.location.assign(url);
  return null;
};

/** Regresso da Microsoft: troca o código pela sessão. */
export const mailAppExchange = async (code: string) =>
  startSession(await call({ action: 'exchange', code }));
