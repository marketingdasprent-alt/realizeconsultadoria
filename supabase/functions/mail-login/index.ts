// Edge function mail-login: entrada na app de email para clientes de fora
// (email.realizeconsultadoria.pt) com a própria caixa — sem conta na Realize.
//
// POST (sem sessão; verify_jwt = false):
//   { action: 'discover', email }            → servidores IMAP/SMTP do domínio (DNS)
//   { action: 'imap', provider, email, password, imap_host, imap_port, smtp_host, smtp_port,
//     display_name? }                        → testa o login, liga a caixa e devolve a sessão
//   { action: 'oauth-start', provider }      → URL da Microsoft (regressa com ?login=<código>)
//   { action: 'exchange', code }             → troca o código pela sessão
// A sessão é de uma conta interna só de email (papel mail_client na base de dados).

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { MAIL_ERROR_MESSAGES, isMailError } from '../_shared/mail/errors.ts';
import { discoverDomain, domainOfEmail } from '../_shared/mail/discover.ts';
import {
  buildAuthorizeUrl,
  oauthProviderFor,
  pkceChallenge,
  randomBase64Url,
} from '../_shared/mail/oauth.ts';
import { isRecord, optionalString, parseImapConnectRequest } from '../_shared/mail/request.ts';
import { saveMailAccount, storeSecret } from '../_shared/mail-server/accounts.ts';
import { denoResolver } from '../_shared/mail-server/dns.ts';
import { corsHeaders, errorMessage, json, serviceClient } from '../_shared/mail-server/http.ts';
import {
  MAIL_APP_ORIGIN,
  consumeLoginCode,
  mailAppSession,
  mailAppUser,
} from '../_shared/mail-server/mailAppSession.ts';
import { oauthCredentials, oauthRedirectUri } from '../_shared/mail-server/oauth-client.ts';
import { testImapLogin } from '../mail-api/drivers/imap.ts';

/** Tentativas falhadas: por caixa (15 min) e por IP (1 h). */
const MAX_PER_MAILBOX = 6;
const MAX_PER_IP = 30;

type Db = ReturnType<typeof serviceClient>;

const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';

const tooManyAttempts = async (db: Db, mailbox: string, ip: string) => {
  const since15 = new Date(Date.now() - 15 * 60_000).toISOString();
  const since60 = new Date(Date.now() - 60 * 60_000).toISOString();
  const [{ count: byMailbox }, { count: byIp }] = await Promise.all([
    db
      .from('mail_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('mailbox', mailbox)
      .gte('created_at', since15),
    db
      .from('mail_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since60),
  ]);
  return (byMailbox ?? 0) >= MAX_PER_MAILBOX || (byIp ?? 0) >= MAX_PER_IP;
};

const loginImap = async (req: Request, body: Record<string, unknown>) => {
  const db = serviceClient();
  const parsed = parseImapConnectRequest(body);
  if (!parsed.ok)
    return json({
      ok: false,
      code: parsed.code,
      message:
        parsed.code === 'smtp_port_blocked'
          ? MAIL_ERROR_MESSAGES.smtp_port_blocked
          : 'Confirme o email, a palavra-passe e os servidores.',
    });
  const input = parsed.value;
  const ip = clientIp(req);
  if (await tooManyAttempts(db, input.email, ip))
    return json({
      ok: false,
      code: 'rate_limited',
      message: 'Demasiadas tentativas. Espere 15 minutos e volte a tentar.',
    });
  try {
    await testImapLogin({
      email: input.email,
      displayName: input.displayName,
      username: input.email,
      password: input.password,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
    });
  } catch (error) {
    await db.from('mail_login_attempts').insert({ mailbox: input.email, ip });
    return json({
      ok: false,
      code: isMailError(error) ? error.code : 'imap_login_failed',
      message:
        isMailError(error) && error.message
          ? error.message
          : MAIL_ERROR_MESSAGES.imap_login_failed,
    });
  }
  // A palavra-passe abriu a caixa: é dela. Liga a caixa à conta interna e entra.
  const userId = await mailAppUser(db, input.email, input.displayName);
  const account = await saveMailAccount(db, {
    userId,
    provider: input.provider,
    authMethod: 'imap',
    email: input.email,
    displayName: input.displayName,
    overrideDisplayName: !!input.displayName,
    server: {
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
    },
  });
  await storeSecret(db, account.id, { username: input.email, password: input.password });
  return json({ ok: true, data: await mailAppSession(db, userId) });
};

const oauthStart = async (body: Record<string, unknown>) => {
  const oauth = oauthProviderFor(body.provider);
  // Só Microsoft (a app Google ainda não está criada)
  if (oauth !== 'microsoft') return json({ ok: false, code: 'bad_request' }, 400);
  const credentials = oauthCredentials(oauth);
  if (!credentials)
    return json({ ok: false, code: 'not_configured', message: 'A Microsoft não está configurada.' });
  const db = serviceClient();
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(32);
  const { error } = await db.from('mail_oauth_states').insert({
    state,
    user_id: null,
    login: true,
    oauth_provider: oauth,
    mail_provider: body.provider,
    redirect_to: `${MAIL_APP_ORIGIN}/`,
    code_verifier: codeVerifier,
  });
  if (error) return json({ ok: false, code: 'server_error' }, 500);
  const url = buildAuthorizeUrl(oauth, {
    clientId: credentials.clientId,
    redirectUri: oauthRedirectUri(),
    state,
    codeChallenge: await pkceChallenge(codeVerifier),
  });
  return json({ ok: true, data: { url } });
};

const exchange = async (body: Record<string, unknown>) => {
  const db = serviceClient();
  const userId = await consumeLoginCode(db, optionalString(body.code, 100) ?? '');
  if (!userId)
    return json({
      ok: false,
      code: 'expired',
      message: 'O pedido de entrada expirou. Volte a entrar com a Microsoft.',
    });
  return json({ ok: true, data: await mailAppSession(db, userId) });
};

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  if (!isRecord(body)) return json({ ok: false, code: 'bad_request' }, 400);
  try {
    if (body.action === 'discover') {
      const email = optionalString(body.email, 254);
      if (!email) return json({ ok: false, code: 'bad_request' }, 400);
      return json({ ok: true, data: await discoverDomain(domainOfEmail(email), denoResolver) });
    }
    if (body.action === 'imap') return await loginImap(req, body);
    if (body.action === 'oauth-start') return await oauthStart(body);
    if (body.action === 'exchange') return await exchange(body);
    return json({ ok: false, code: 'bad_request' }, 400);
  } catch (error) {
    console.error('mail-login:', errorMessage(error));
    return json({ ok: false, code: 'server_error', message: 'Erro no servidor. Tente outra vez.' });
  }
});
