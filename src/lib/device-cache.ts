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
