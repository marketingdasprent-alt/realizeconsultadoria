// OAuth 2.0 (Google e Microsoft) do Webmail: âmbitos, URL de autorização com PKCE,
// validação do redirect_to e leitura dos segredos guardados no Vault. Sem I/O.

import { base64UrlEncode } from './mime.ts';
import type {
  ImapSecret,
  MailAuthMethod,
  MailProviderKey,
  OAuthProvider,
  OAuthSecret,
} from './types.ts';

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraParams: Record<string, string>;
}

export const OAUTH_CONFIG: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope:
      'openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
    extraParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope:
      'offline_access openid email profile https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
    extraParams: { response_mode: 'query', prompt: 'select_account' },
  },
};

export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/** O state OAuth só vale 10 minutos. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Margem antes de expirar para renovar o access token. */
export const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

const OAUTH_BY_PROVIDER: Partial<Record<MailProviderKey, OAuthProvider>> = {
  gmail: 'google',
  outlook: 'microsoft',
  office365: 'microsoft',
  exchange: 'microsoft',
};

export const oauthProviderFor = (provider: unknown): OAuthProvider | null =>
  typeof provider === 'string' ? (OAUTH_BY_PROVIDER[provider as MailProviderKey] ?? null) : null;

export const authMethodFor = (oauth: OAuthProvider): MailAuthMethod =>
  oauth === 'google' ? 'oauth-google' : 'oauth-microsoft';

export const oauthProviderOfMethod = (method: MailAuthMethod): OAuthProvider | null =>
  method === 'oauth-google' ? 'google' : method === 'oauth-microsoft' ? 'microsoft' : null;

/** Bytes aleatórios em base64url (state, code_verifier). 32 bytes → 43 caracteres. */
export const randomBase64Url = (bytes = 32): string =>
  base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));

/** PKCE S256: base64url(sha256(code_verifier)). */
export const pkceChallenge = async (verifier: string): Promise<string> =>
  base64UrlEncode(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  );

export const buildAuthorizeUrl = (
  provider: OAuthProvider,
  params: { clientId: string; redirectUri: string; state: string; codeChallenge: string }
): string => {
  const config = OAUTH_CONFIG[provider];
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    ...config.extraParams,
  });
  return `${config.authorizeUrl}?${query.toString()}`;
};

/** MAIL_ALLOWED_ORIGINS ("http://localhost:8080,https://app.exemplo.pt") → origens normalizadas. */
export const parseAllowedOrigins = (csv: string | null | undefined): string[] =>
  (csv ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
    .map(o => {
      try {
        return new URL(o).origin;
      } catch {
        return null;
      }
    })
    .filter((o): o is string => !!o && o !== 'null');

/** O redirect_to tem de ser http(s) e de uma origem autorizada. */
export const isAllowedRedirect = (redirectTo: unknown, allowedOrigins: string[]): boolean => {
  if (typeof redirectTo !== 'string' || redirectTo.length > 2000) return false;
  try {
    const url = new URL(redirectTo);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
};

/** Junta ?mail=...&motivo=... ao redirect_to, mantendo os parâmetros que já lá estão. */
export const withResultParams = (redirectTo: string, params: Record<string, string>): string => {
  const url = new URL(redirectTo);
  url.searchParams.delete('mail');
  url.searchParams.delete('motivo');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};

export const isStateExpired = (createdAt: string, nowMs: number): boolean => {
  const created = Date.parse(createdAt);
  return !Number.isFinite(created) || nowMs - created > OAUTH_STATE_TTL_MS;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/** Código de erro OAuth ("invalid_grant", ...) de uma resposta do endpoint de tokens. */
export const oauthErrorCode = (json: unknown): string | null =>
  isRecord(json) ? str(json.error) : null;

/**
 * Resposta do endpoint de tokens → segredo a guardar. Se não vier refresh_token
 * (renovação no Google, ou reautorização sem novo consentimento) mantém-se o anterior.
 */
export const tokenResponseToSecret = (
  json: unknown,
  nowMs: number,
  previousRefreshToken: string | null = null
): OAuthSecret | null => {
  if (!isRecord(json)) return null;
  const accessToken = str(json.access_token);
  if (!accessToken) return null;
  const expiresIn = Number(json.expires_in);
  return {
    access_token: accessToken,
    refresh_token: str(json.refresh_token) ?? previousRefreshToken,
    expires_at: nowMs + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
    scope: str(json.scope),
  };
};

export const needsRefresh = (secret: OAuthSecret, nowMs: number): boolean =>
  secret.expires_at - TOKEN_REFRESH_SKEW_MS < nowMs;

const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Segredo OAuth lido do Vault (texto JSON) ou null se estiver incompleto. */
export const parseOAuthSecret = (raw: unknown): OAuthSecret | null => {
  const json = parseJson(raw);
  if (!isRecord(json)) return null;
  const accessToken = str(json.access_token);
  const expiresAt = Number(json.expires_at);
  if (!accessToken) return null;
  return {
    access_token: accessToken,
    refresh_token: str(json.refresh_token),
    expires_at: Number.isFinite(expiresAt) ? expiresAt : 0,
    scope: str(json.scope),
  };
};

export const parseImapSecret = (raw: unknown): ImapSecret | null => {
  const json = parseJson(raw);
  if (!isRecord(json)) return null;
  const username = str(json.username);
  const password = str(json.password);
  return username && password ? { username, password } : null;
};

export interface MailboxIdentity {
  email: string;
  name: string | null;
}

/** Google userinfo (v3) → email e nome. */
export const googleIdentity = (json: unknown): MailboxIdentity | null => {
  if (!isRecord(json)) return null;
  const email = str(json.email);
  return email ? { email: email.toLowerCase(), name: str(json.name) } : null;
};

/** Graph /me → mail (ou userPrincipalName nas contas pessoais) e displayName. */
export const microsoftIdentity = (json: unknown): MailboxIdentity | null => {
  if (!isRecord(json)) return null;
  const email = str(json.mail) ?? str(json.userPrincipalName);
  return email && email.includes('@')
    ? { email: email.toLowerCase(), name: str(json.displayName) }
    : null;
};
