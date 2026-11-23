// Cache no aparelho, por utilizador: o que a app já mostrou da última vez aparece logo ao abrir
// e a versão nova chega em segundo plano. Tudo é apagado ao terminar a sessão.

const PREFIX = 'rz-cache:';

/** Utilizador da sessão guardada pelo Supabase (sem esperar pela rede). */
export const sessionUserId = (): string | null => {
  try {
    const key = Object.keys(localStorage).find(k => /^sb-.+-auth-token$/.test(k));
    if (!key) return null;
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as {
      user?: { id?: string };
    } | null;
    return parsed?.user?.id ?? null;
  } catch {
    return null;
  }
};

const keyFor = (name: string, userId: string) => `${PREFIX}${userId}:${name}`;

export const readDeviceCache = <T>(name: string, userId: string | null): T | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(keyFor(name, userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeDeviceCache = (name: string, userId: string | null, value: unknown) => {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(name, userId), JSON.stringify(value));
  } catch {
    // Sem espaço ou sem armazenamento: segue sem cache.
  }
};

/** A sessão já é outra desde que `requester` fez o pedido? (sem dono conhecido, não há o que comparar) */
export const sessionChangedSince = (requester: string | null): boolean =>
  !!requester && sessionUserId() !== requester;

/** Grava só se a sessão ainda for a de `ownerId` (para escritas depois de um pedido à rede). */
export const writeDeviceCacheIfSession = (name: string, ownerId: string | null, value: unknown) => {
  if (ownerId && sessionUserId() === ownerId) writeDeviceCache(name, ownerId, value);
};

/** Ao terminar a sessão: nada fica no aparelho. */
export const clearDeviceCache = () => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // ignora
  }
};

/** Chaves por utilizador: o prefixo é seguido do id (e, às vezes, de `:` e do resto). */
const USER_DATA_PREFIXES = [PREFIX, 'rz-mail-cache:', 'rz-ai-chat:', 'rz.role.', 'rz-tabs:'];
/** Chaves sem utilizador (rascunhos, recentes…): ficam para a conta seguinte, por isso saem sempre. */
const GLOBAL_KEYS = [
  'rz.admin.broadcast.draft',
  'rz.people.recent',
  'rz.mail.supportCompany',
  'rz-last-punch-at',
  'rz.mail.contacts.backfilled',
  'rz.admin.company-scope',
];

const isKeptKey = (key: string, keepUserId: string) =>
  USER_DATA_PREFIXES.some(
    prefix => key === prefix + keepUserId || key.startsWith(`${prefix}${keepUserId}:`)
  );

/**
 * Apaga tudo o que a app guarda por utilizador no aparelho (não toca na sessão nem no tema).
 * `keepUserId` poupa as chaves exatas do utilizador que acabou de entrar.
 */
export const clearAllDeviceData = (keepUserId?: string | null) => {
  try {
    Object.keys(localStorage)
      .filter(
        k => GLOBAL_KEYS.includes(k) || USER_DATA_PREFIXES.some(prefix => k.startsWith(prefix))
      )
      .filter(k => !keepUserId || !isKeptKey(k, keepUserId))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // ignora
  }
};
