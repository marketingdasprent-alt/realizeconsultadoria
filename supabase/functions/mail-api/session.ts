// Sessão OAuth de uma conta: renova o access token quando faltar menos de 60 s, repete
// uma vez após 401 e, se a autorização foi revogada, marca a conta como 'reauth'.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mailError, type MailError } from '../_shared/mail/errors.ts';
import { needsRefresh } from '../_shared/mail/oauth.ts';
import type { OAuthProvider, OAuthSecret } from '../_shared/mail/types.ts';
import { storeSecret, updateAccountStatus } from '../_shared/mail-server/accounts.ts';
import { errorMessage, fetchWithTimeout } from '../_shared/mail-server/http.ts';
import { oauthCredentials, refreshAccessToken } from '../_shared/mail-server/oauth-client.ts';

export interface ApiRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export class OAuthSession {
  private refreshed = false;
  private refreshing: Promise<void> | null = null;

  /**
   * `appToken`: caixas da empresa lidas com a permissão da própria app (sem utilizador nem
   * refresh token): o token novo vem daqui e não se guarda no Vault.
   */
  constructor(
    private readonly db: SupabaseClient,
    private readonly accountId: string,
    readonly provider: OAuthProvider,
    private secret: OAuthSecret,
    private readonly appToken?: () => Promise<OAuthSecret>
  ) {}

  /** Marca a conta para voltar a ligar e devolve o erro a lançar. */
  async reauth(): Promise<MailError> {
    await updateAccountStatus(this.db, this.accountId, {
      status: 'reauth',
      last_error: 'Autorização expirada ou revogada.',
    });
    return mailError('reauth');
  }

  private async doRefresh(): Promise<void> {
    if (this.appToken) {
      this.secret = await this.appToken();
      this.refreshed = true;
      return;
    }
    if (!this.secret.refresh_token) throw await this.reauth();
    const credentials = oauthCredentials(this.provider);
    if (!credentials) throw mailError('provider_error', 'A ligação OAuth não está configurada.');
    const result = await refreshAccessToken(this.provider, credentials, this.secret.refresh_token);
    if ('error' in result) {
      if (result.error === 'invalid_grant' || result.error === 'interaction_required') {
        throw await this.reauth();
      }
      throw mailError('provider_error');
    }
    this.secret = result.secret;
    this.refreshed = true;
    await storeSecret(this.db, this.accountId, this.secret);
  }

  /** Uma só renovação de cada vez (os pedidos em paralelo esperam pela mesma). */
  private refresh(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async token(): Promise<string> {
    if (this.refreshing) await this.refreshing;
    if (needsRefresh(this.secret, Date.now())) await this.refresh();
    return this.secret.access_token;
  }

  /** Pedido autenticado à API do fornecedor (erros de rede → provider_error). */
  async fetch(url: string, init: ApiRequestInit = {}): Promise<Response> {
    const send = async (token: string) => {
      try {
        return await fetchWithTimeout(url, {
          method: init.method ?? 'GET',
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
          body: init.body,
        });
      } catch (error) {
        console.error(`mail-api ${this.provider}: sem resposta`, errorMessage(error));
        throw mailError('provider_error', 'Sem resposta do fornecedor de email.');
      }
    };
    const used = await this.token();
    let res = await send(used);
    if (res.status !== 401) return res;

    await res.body?.cancel();
    // Pedidos em paralelo: se outro já renovou o token, basta repetir com o novo.
    if (used === this.secret.access_token) {
      if (this.refreshed) throw await this.reauth();
      await this.refresh();
    }
    res = await send(await this.token());
    if (res.status === 401) {
      await res.body?.cancel();
      throw await this.reauth();
    }
    return res;
  }

  /** Converte respostas de erro em MailError (404, 429, permissões em falta, ...). */
  async ensureOk(res: Response, notFound = mailError('message_not_found')): Promise<Response> {
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    if (res.status === 404) throw notFound;
    if (res.status === 429 || /ratelimitexceeded/i.test(text)) throw mailError('rate_limited');
    // Permissões recusadas no consentimento (ex. sem gmail.modify): é preciso voltar a ligar.
    if (res.status === 403 && /insufficient|scope|accessdenied/i.test(text)) {
      throw await this.reauth();
    }
    console.error(`mail-api ${this.provider}: HTTP ${res.status}`, text.slice(0, 300));
    throw mailError('provider_error');
  }

  async json<T>(url: string, init: ApiRequestInit = {}): Promise<T> {
    const res = await this.ensureOk(await this.fetch(url, init));
    return (await res.json()) as T;
  }
}
