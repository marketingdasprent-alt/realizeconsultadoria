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

/** Tudo o que a app guarda por utilizador: cache, emails, conversa com a IA e papel. */
const USER_DATA_PREFIXES = [PREFIX, 'rz-mail-cache:', 'rz-ai-chat:', 'rz.role.'];

/**
 * Apaga tudo o que a app guarda por utilizador no aparelho (não toca na sessão nem no tema).
 * `keepUserId` poupa o utilizador que acabou de entrar.
 */
export const clearAllDeviceData = (keepUserId?: string | null) => {
  try {
    Object.keys(localStorage)
      .filter(k => USER_DATA_PREFIXES.some(prefix => k.startsWith(prefix)))
      .filter(k => !keepUserId || !k.includes(keepUserId))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // ignora
  }
};
