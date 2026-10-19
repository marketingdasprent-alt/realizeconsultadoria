// Última lista de emails de cada caixa/pasta, guardada no browser do próprio utilizador:
// ao abrir o Webmail mostra-se logo (o servidor IMAP demora segundos a responder) e a lista
// nova chega em segundo plano. Só a 1.ª página, sem pesquisa; limpa ao terminar a sessão.

const PREFIX = 'rz-mail-cache:';
const MAX_ENTRIES = 20;

interface CacheEntry<T> {
  savedAt: number;
  page: T;
}

const keyFor = (userId: string, key: string) => `${PREFIX}${userId}:${key}`;

export const readListCache = <T>(userId: string, key: string): CacheEntry<T> | null => {
  try {
    const raw = localStorage.getItem(keyFor(userId, key));
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
};

export const writeListCache = <T>(userId: string, key: string, page: T) => {
  try {
    localStorage.setItem(keyFor(userId, key), JSON.stringify({ savedAt: Date.now(), page }));
    // Mantém só as caixas/pastas mais recentes.
    const entries = Object.keys(localStorage)
      .filter(k => k.startsWith(`${PREFIX}${userId}:`))
      .map(k => ({
        k,
        savedAt: (JSON.parse(localStorage.getItem(k) ?? '{}') as CacheEntry<T>).savedAt ?? 0,
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
    entries.slice(MAX_ENTRIES).forEach(entry => localStorage.removeItem(entry.k));
  } catch {
    // Sem espaço ou sem acesso ao armazenamento: segue sem cache.
  }
};

interface CachedMail {
  id: string;
  accountId: string;
}

/**
 * Aplica a mesma mudança às listas guardadas (todas as caixas/pastas deste utilizador): um
 * email apagado não volta a aparecer ao mudar de caixa ou ao reabrir o Webmail.
 */
export const patchListCaches = (
  userId: string,
  target: CachedMail,
  patch: Record<string, unknown> | 'remove'
) => {
  try {
    const same = (m: CachedMail) => m.id === target.id && m.accountId === target.accountId;
    Object.keys(localStorage)
      .filter(k => k.startsWith(`${PREFIX}${userId}:`))
      .forEach(k => {
        const entry = JSON.parse(localStorage.getItem(k) ?? 'null') as CacheEntry<{
          messages?: CachedMail[];
        }> | null;
        const messages = entry?.page?.messages;
        if (!entry || !Array.isArray(messages) || !messages.some(same)) return;
        const next =
          patch === 'remove'
            ? messages.filter(m => !same(m))
            : messages.map(m => (same(m) ? { ...m, ...patch } : m));
        localStorage.setItem(
          k,
          JSON.stringify({ ...entry, page: { ...entry.page, messages: next } })
        );
      });
  } catch {
    // sem acesso ao armazenamento: a lista nova corrige na mesma
  }
};

/** Ao terminar a sessão: nada de emails fica no browser. */
export const clearMailCache = () => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // ignora
  }
};
