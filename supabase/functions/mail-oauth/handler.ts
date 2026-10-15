// Ligação de caixas de email por OAuth (Gmail / Google Workspace, Outlook.com, Microsoft 365).
//
// POST { action: 'start', provider: 'gmail' | 'outlook' | 'office365' | 'exchange',
//        redirect_to } com Authorization: Bearer <JWT do utilizador>
//   → { ok: true, data: { url } } — URL de autorização do Google/Microsoft (state + PKCE S256).
// GET ?code=&state= (ou ?error=) — callback do fornecedor: troca o código por tokens,
//   identifica a caixa, cria/atualiza mail_accounts, guarda os tokens no Vault e redireciona
//   (302) para redirect_to com ?mail=ligada, ou ?mail=erro&motivo=<código>. Nunca vão tokens
//   nem erros do fornecedor no URL.
// Motivos: expirado, cancelado, fornecedor, nao_configurado, token, identidade, servidor.
// verify_jwt = false: o callback vem do browser sem JWT; o POST valida o JWT aqui.

import {
  OAUTH_STATE_TTL_MS,
  authMethodFor,
  buildAuthorizeUrl,
  isAllowedRedirect,
  isStateExpired,
  oauthProviderFor,
  parseAllowedOrigins,
  parseOAuthSecret,
  pkceChallenge,
  randomBase64Url,
  withResultParams,
} from '../_shared/mail/oauth.ts';
import { MAIL_PROVIDER_KEYS, isRecord } from '../_shared/mail/request.ts';
import type { MailProviderKey, OAuthProvider } from '../_shared/mail/types.ts';
import { readSecret, saveMailAccount, storeSecret } from '../_shared/mail-server/accounts.ts';
import {
  authenticatedUserId,
  corsHeaders,
  errorMessage,
  json,
  serviceClient,
} from '../_shared/mail-server/http.ts';
import {
  exchangeCode,
  fetchMailboxIdentity,
  oauthCredentials,
  oauthRedirectUri,
} from '../_shared/mail-server/oauth-client.ts';

interface OAuthStateRow {
  user_id: string;
  oauth_provider: string;
  mail_provider: string;
  redirect_to: string;
  code_verifier: string;
  created_at: string;
}

const allowedOrigins = () => parseAllowedOrigins(Deno.env.get('MAIL_ALLOWED_ORIGINS'));

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });

// A Supabase serve text/html como texto simples, por isso a mensagem já vai em texto.
const plainText = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const handleStart = async (req: Request): Promise<Response> => {
  const db = serviceClient();
  const userId = await authenticatedUserId(req, db);
  if (!userId) return json({ ok: false, code: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  if (!isRecord(body) || body.action !== 'start')
    return json({ ok: false, code: 'bad_request' }, 400);

  if (!isAllowedRedirect(body.redirect_to, allowedOrigins())) {
    return json({
      ok: false,
      code: 'bad_redirect',
      message: 'Endereço de regresso não autorizado.',
    });
  }
  const redirectTo = body.redirect_to as string;
  const oauth = oauthProviderFor(body.provider);
  if (!oauth) return json({ ok: false, code: 'bad_request' }, 400);

  const credentials = oauthCredentials(oauth);
  if (!credentials) {
    return json({
      ok: false,
      code: 'not_configured',
      message: `A ligação a contas ${oauth === 'google' ? 'Google' : 'Microsoft'} ainda não está configurada.`,
    });
  }

  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(32);

  // Limpeza dos pedidos abandonados (melhor esforço).
  await db
    .from('mail_oauth_states')
    .delete()
    .lt('created_at', new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString());

  const { error } = await db.from('mail_oauth_states').insert({
    state,
    user_id: userId,
    oauth_provider: oauth,
    mail_provider: body.provider,
    redirect_to: redirectTo,
    code_verifier: codeVerifier,
  });
  if (error) {
    console.error('mail-oauth: falha ao guardar o state', error.message);
    return json({ ok: false, code: 'server_error' }, 500);
  }

  const url = buildAuthorizeUrl(oauth, {
    clientId: credentials.clientId,
    redirectUri: oauthRedirectUri(),
    state,
    codeChallenge: await pkceChallenge(codeVerifier),
  });
  return json({ ok: true, data: { url } });
};

const handleCallback = async (req: Request): Promise<Response> => {
  const params = new URL(req.url).searchParams;
  const state = params.get('state');
  if (!state || state.length > 200) {
    return plainText(
      400,
      'Pedido inválido. Feche esta janela e volte a tentar a partir do Realize.'
    );
  }

  // Lê e apaga de uma vez: cada state só serve uma vez.
  const db = serviceClient();
  const { data, error } = await db
    .from('mail_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id, oauth_provider, mail_provider, redirect_to, code_verifier, created_at')
    .maybeSingle();
  const row = data as OAuthStateRow | null;
  if (error || !row) {
    if (error) console.error('mail-oauth: falha ao ler o state', error.message);
    return plainText(
      400,
      'Este pedido de ligação já foi usado ou expirou. Volte a tentar a partir do Realize.'
    );
  }
  // As origens podem ter mudado desde o início do pedido: nunca redirecionar para fora.
  if (!isAllowedRedirect(row.redirect_to, allowedOrigins())) {
    return plainText(400, 'Endereço de regresso não autorizado.');
  }

  const fail = (motivo: string) =>
    redirect(withResultParams(row.redirect_to, { mail: 'erro', motivo }));

  if (isStateExpired(row.created_at, Date.now())) return fail('expirado');
  const providerError = params.get('error');
  if (providerError) return fail(providerError === 'access_denied' ? 'cancelado' : 'fornecedor');
  const code = params.get('code');
  if (!code) return fail('fornecedor');

  const oauth: OAuthProvider | null =
    row.oauth_provider === 'google' || row.oauth_provider === 'microsoft'
      ? row.oauth_provider
      : null;
  if (!oauth) return fail('fornecedor');
  const credentials = oauthCredentials(oauth);
  if (!credentials) return fail('nao_configurado');
  const mailProvider: MailProviderKey =
    MAIL_PROVIDER_KEYS.find(p => p === row.mail_provider && oauthProviderFor(p) === oauth) ??
    (oauth === 'google' ? 'gmail' : 'outlook');

  try {
    const exchanged = await exchangeCode(oauth, credentials, code, row.code_verifier);
    if ('error' in exchanged) return fail('token');

    const identity = await fetchMailboxIdentity(oauth, exchanged.secret.access_token);
    if (!identity) return fail('identidade');

    const account = await saveMailAccount(db, {
      userId: row.user_id,
      provider: mailProvider,
      authMethod: authMethodFor(oauth),
      email: identity.email,
      displayName: identity.name,
    });

    let secret = exchanged.secret;
    if (!secret.refresh_token && account.existed) {
      // O Google só envia refresh_token quando há consentimento (prompt=consent pede-o
      // sempre, mas por precaução mantém-se o anterior). Sem nenhum, a conta funciona até
      // o access token expirar (~1 h) e depois fica em 'reauth' para voltar a ligar.
      const previous = parseOAuthSecret(await readSecret(db, account.id));
      if (previous?.refresh_token) secret = { ...secret, refresh_token: previous.refresh_token };
    }
    await storeSecret(db, account.id, secret);

    return redirect(withResultParams(row.redirect_to, { mail: 'ligada' }));
  } catch (err) {
    console.error('mail-oauth: falha no callback', errorMessage(err));
    return fail('servidor');
  }
};

/** Pedido HTTP → resposta (servido por index.ts, ou pelo servidor local de desenvolvimento). */
export const mailOAuthHandler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return handleCallback(req);
  if (req.method === 'POST') return handleStart(req);
  return json({ ok: false, code: 'method_not_allowed' }, 405);
};
