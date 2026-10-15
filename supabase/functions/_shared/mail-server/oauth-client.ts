// Pedidos OAuth aos fornecedores (troca de código, renovação, identidade, revogação).
// Nunca registar tokens nem respostas completas nos logs.

import {
  GOOGLE_REVOKE_URL,
  OAUTH_CONFIG,
  googleIdentity,
  microsoftIdentity,
  oauthErrorCode,
  tokenResponseToSecret,
  type MailboxIdentity,
} from '../mail/oauth.ts';
import type { OAuthProvider, OAuthSecret } from '../mail/types.ts';
import { errorMessage, fetchWithTimeout } from './http.ts';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/** Credenciais da app OAuth (secrets da função) ou null se não estiverem configuradas. */
export const oauthCredentials = (provider: OAuthProvider): OAuthCredentials | null => {
  const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
  const clientId = Deno.env.get(`${prefix}_OAUTH_CLIENT_ID`)?.trim();
  const clientSecret = Deno.env.get(`${prefix}_OAUTH_CLIENT_SECRET`)?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

/** URI de retorno registado no Google Cloud e no Entra: a própria função mail-oauth. */
export const oauthRedirectUri = (): string =>
  `${Deno.env.get('SUPABASE_URL')!.replace(/\/+$/, '')}/functions/v1/mail-oauth`;

type TokenResult = { secret: OAuthSecret } | { error: string };

const postToken = async (
  provider: OAuthProvider,
  params: Record<string, string>,
  previousRefreshToken: string | null
): Promise<TokenResult> => {
  let res: Response;
  try {
    res = await fetchWithTimeout(OAUTH_CONFIG[provider].tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (error) {
    console.error(`mail oauth ${provider}: token sem resposta`, errorMessage(error));
    return { error: 'network' };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = oauthErrorCode(body) ?? `http_${res.status}`;
    console.error(`mail oauth ${provider}: token recusado (${res.status})`, code);
    return { error: code };
  }
  const secret = tokenResponseToSecret(body, Date.now(), previousRefreshToken);
  return secret ? { secret } : { error: 'invalid_response' };
};

/** Troca o código de autorização (com o code_verifier PKCE) por tokens. */
export const exchangeCode = (
  provider: OAuthProvider,
  credentials: OAuthCredentials,
  code: string,
  codeVerifier: string
): Promise<TokenResult> =>
  postToken(
    provider,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthRedirectUri(),
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code_verifier: codeVerifier,
      ...(provider === 'microsoft' ? { scope: OAUTH_CONFIG.microsoft.scope } : {}),
    },
    null
  );

/**
 * Renova o access token. O Google normalmente não devolve novo refresh_token (mantém-se o
 * anterior); a Microsoft roda-o a cada renovação. Erro 'invalid_grant' = autorização revogada.
 */
export const refreshAccessToken = (
  provider: OAuthProvider,
  credentials: OAuthCredentials,
  refreshToken: string
): Promise<TokenResult> =>
  postToken(
    provider,
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      ...(provider === 'microsoft' ? { scope: OAUTH_CONFIG.microsoft.scope } : {}),
    },
    refreshToken
  );

/** Email e nome da caixa autorizada (Google userinfo / Graph /me). */
export const fetchMailboxIdentity = async (
  provider: OAuthProvider,
  accessToken: string
): Promise<MailboxIdentity | null> => {
  const url =
    provider === 'google'
      ? 'https://www.googleapis.com/oauth2/v3/userinfo'
      : 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName';
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error(`mail oauth ${provider}: identidade recusada (${res.status})`);
      return null;
    }
    const body: unknown = await res.json();
    return provider === 'google' ? googleIdentity(body) : microsoftIdentity(body);
  } catch (error) {
    console.error(`mail oauth ${provider}: identidade sem resposta`, errorMessage(error));
    return null;
  }
};

/** Revoga o token no Google (melhor esforço; a Microsoft não tem endpoint equivalente). */
export const revokeGoogleToken = async (token: string): Promise<void> => {
  try {
    await fetchWithTimeout(
      GOOGLE_REVOKE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      },
      8000
    );
  } catch (error) {
    console.warn('mail oauth google: revogação falhou', errorMessage(error));
  }
};
