// Esperas entre tentativas quando a BD não responde: sem isto, cada falha voltava a pedir
// de imediato e os browsers abertos martelavam uma BD que já estava em baixo (queda de 21/10).

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 30_000;

/** Espera antes da tentativa seguinte (attempt = 0, 1, 2…): 2 s, 4 s, 8 s, 16 s e depois 30 s. */
export const retryDelayMs = (attempt: number): number =>
  Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt), RETRY_MAX_MS);

/**
 * Falha passageira de um pedido ao Supabase, que vale a pena repetir mais tarde: sem ligação
 * (status 0), BD em baixo ou a arrancar (5xx, incluindo o PGRST002 do PostgREST sem esquema),
 * tempo esgotado (408) ou pedidos a mais (429). Não inclui "não existe" nem falta de permissão.
 */
export const isTransientQueryError = (
  status: number,
  error: { code?: string | null } | null
): boolean => {
  if (!error) return false;
  if (status === 0 || status === 408 || status === 429 || status >= 500) return true;
  return /^PGRST00\d$/.test(error.code ?? '');
};
