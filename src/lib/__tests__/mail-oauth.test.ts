// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeUrl,
  isAllowedRedirect,
  isStateExpired,
  microsoftIdentity,
  googleIdentity,
  needsRefresh,
  oauthProviderFor,
  parseAllowedOrigins,
  parseImapSecret,
  parseOAuthSecret,
  pkceChallenge,
  randomBase64Url,
  tokenResponseToSecret,
  withResultParams,
} from '../../../supabase/functions/_shared/mail/oauth';

describe('OAuth do Webmail', () => {
  it('mapeia fornecedores para Google/Microsoft', () => {
    expect(oauthProviderFor('gmail')).toBe('google');
    expect(oauthProviderFor('outlook')).toBe('microsoft');
    expect(oauthProviderFor('office365')).toBe('microsoft');
    expect(oauthProviderFor('exchange')).toBe('microsoft');
    expect(oauthProviderFor('icloud')).toBeNull();
    expect(oauthProviderFor(undefined)).toBeNull();
  });

  it('gera state/verifier base64url e o desafio PKCE S256', async () => {
    const verifier = randomBase64Url(32);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomBase64Url(32)).not.toBe(verifier);
    expect(await pkceChallenge(verifier)).toBe(
      createHash('sha256').update(verifier).digest('base64url')
    );
  });

  it('monta o URL de autorização de cada fornecedor', () => {
    const google = new URL(
      buildAuthorizeUrl('google', {
        clientId: 'cid',
        redirectUri: 'https://proj.supabase.co/functions/v1/mail-oauth',
        state: 'st',
        codeChallenge: 'ch',
      })
    );
    expect(google.origin + google.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(google.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/gmail.modify'
    );
    expect(google.searchParams.get('access_type')).toBe('offline');
    expect(google.searchParams.get('prompt')).toBe('consent');
    expect(google.searchParams.get('code_challenge_method')).toBe('S256');
    expect(google.searchParams.get('redirect_uri')).toBe(
      'https://proj.supabase.co/functions/v1/mail-oauth'
    );

    const microsoft = new URL(
      buildAuthorizeUrl('microsoft', {
        clientId: 'cid',
        redirectUri: 'https://proj.supabase.co/functions/v1/mail-oauth',
        state: 'st',
        codeChallenge: 'ch',
      })
    );
    expect(microsoft.pathname).toBe('/common/oauth2/v2.0/authorize');
    expect(microsoft.searchParams.get('scope')).toContain('offline_access');
    expect(microsoft.searchParams.get('scope')).toContain('https://graph.microsoft.com/Mail.Send');
    expect(microsoft.searchParams.get('response_mode')).toBe('query');
    expect(microsoft.searchParams.get('prompt')).toBe('select_account');
  });

  it('só aceita redirect_to de origens autorizadas', () => {
    const allowed = parseAllowedOrigins(' http://localhost:8080 , https://app.realize.pt/ ,lixo');
    expect(allowed).toEqual(['http://localhost:8080', 'https://app.realize.pt']);
    expect(isAllowedRedirect('https://app.realize.pt/colaborador/email?x=1', allowed)).toBe(true);
    expect(isAllowedRedirect('http://localhost:8080/', allowed)).toBe(true);
    expect(isAllowedRedirect('https://app.realize.pt.evil.com/', allowed)).toBe(false);
    expect(isAllowedRedirect('javascript:alert(1)', allowed)).toBe(false);
    expect(isAllowedRedirect(42, allowed)).toBe(false);
  });

  it('junta o resultado ao redirect_to mantendo os parâmetros existentes', () => {
    expect(withResultParams('https://app.realize.pt/email?tab=contas', { mail: 'ligada' })).toBe(
      'https://app.realize.pt/email?tab=contas&mail=ligada'
    );
    expect(
      withResultParams('https://app.realize.pt/email?mail=ligada', {
        mail: 'erro',
        motivo: 'token',
      })
    ).toBe('https://app.realize.pt/email?mail=erro&motivo=token');
  });

  it('state expira ao fim de 10 minutos', () => {
    const now = Date.UTC(2026, 9, 15, 10, 0);
    expect(isStateExpired(new Date(now - 9 * 60_000).toISOString(), now)).toBe(false);
    expect(isStateExpired(new Date(now - 11 * 60_000).toISOString(), now)).toBe(true);
    expect(isStateExpired('lixo', now)).toBe(true);
  });

  it('converte respostas de token e mantém o refresh_token anterior', () => {
    const now = 1_000_000;
    expect(
      tokenResponseToSecret({ access_token: 'a', expires_in: 3599, scope: 's' }, now, 'r-antigo')
    ).toEqual({
      access_token: 'a',
      refresh_token: 'r-antigo',
      expires_at: now + 3_599_000,
      scope: 's',
    });
    expect(
      tokenResponseToSecret({ access_token: 'a', refresh_token: 'r-novo' }, now)?.refresh_token
    ).toBe('r-novo');
    expect(tokenResponseToSecret({ error: 'invalid_grant' }, now)).toBeNull();
  });

  it('renova 60 s antes de expirar', () => {
    const secret = { access_token: 'a', refresh_token: 'r', expires_at: 100_000, scope: null };
    expect(needsRefresh(secret, 30_000)).toBe(false);
    expect(needsRefresh(secret, 50_000)).toBe(true);
  });

  it('lê segredos do Vault e identidades dos fornecedores', () => {
    expect(parseOAuthSecret('{"access_token":"a","refresh_token":"r","expires_at":5}')).toEqual({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 5,
      scope: null,
    });
    expect(parseOAuthSecret('não é json')).toBeNull();
    expect(parseImapSecret('{"username":"u@x.pt","password":"p"}')).toEqual({
      username: 'u@x.pt',
      password: 'p',
    });
    expect(parseImapSecret('{"username":"u@x.pt"}')).toBeNull();
    expect(googleIdentity({ email: 'Ana@Gmail.com', name: 'Ana' })).toEqual({
      email: 'ana@gmail.com',
      name: 'Ana',
    });
    expect(
      microsoftIdentity({ mail: null, userPrincipalName: 'rui@outlook.com', displayName: 'Rui' })
    ).toEqual({ email: 'rui@outlook.com', name: 'Rui' });
    expect(microsoftIdentity({ mail: null, userPrincipalName: 'sem-arroba' })).toBeNull();
  });
});
