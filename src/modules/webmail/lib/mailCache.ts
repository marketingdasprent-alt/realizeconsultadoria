// Última lista de emails de cada caixa/pasta, guardada no browser do próprio utilizador:
// ao abrir o Webmail mostra-se logo (o servidor IMAP demora segundos a responder) e a lista
// nova chega em segundo plano. Só a 1.ª página, sem pesquisa; limpa ao terminar a sessão.

const PREFIX = 'rz-mail-cache:';
const MAX_ENTRIES = 60;

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

interface MailboxCachePage<M> {
  messages: M[];
  next: Record<string, string>;
  errors: Record<string, never>;
}

const accountKey = (accountId: string, folder: string) => `acct|${accountId}|${folder}`;

/**
 * Lista guardada de uma ou várias caixas (a de "Todas as caixas" junta a de cada uma): não
 * depende da ordem das caixas nem de se ligar ou desligar outra. Mostra-se o que houver.
 */
export const readMailboxCache = <M extends CachedMail & { date: string }>(
  userId: string,
  accountIds: string[],
  folder: string
): { savedAt: number; page: MailboxCachePage<M> } | null => {
  const entries = accountIds
    .map(id =>
      readListCache<{ messages: M[]; next?: Record<string, string> }>(
        userId,
        accountKey(id, folder)
      )
    )
    .filter(
      (entry): entry is NonNullable<typeof entry> => !!entry && Array.isArray(entry.page?.messages)
    );
  if (!entries.length) return null;
  return {
    savedAt: Math.min(...entries.map(entry => entry.savedAt)),
    page: {
      messages: entries
        .flatMap(entry => entry.page.messages)
        .sort((a, b) => b.date.localeCompare(a.date)),
      next: Object.assign({}, ...entries.map(entry => entry.page.next ?? {})),
      errors: {},
    },
  };
};

/** Guarda a lista de cada caixa à parte (as que deram erro ficam com a anterior). */
export const writeMailboxCache = <M extends CachedMail>(
  userId: string,
  accountIds: string[],
  folder: string,
  page: { messages: M[]; next: Record<string, string>; errors: Record<string, unknown> }
) => {
  for (const id of accountIds) {
    if (page.errors[id]) continue;
    writeListCache(userId, accountKey(id, folder), {
      messages: page.messages.filter(message => message.accountId === id),
      next: page.next[id] ? { [id]: page.next[id] } : {},
    });
  }
};

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
