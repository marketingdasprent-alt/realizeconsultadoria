// Quem usa a app: nunca entrou, ou não entra há uma semana ou mais (para reenviar o convite).

export const STALE_DAYS = 7;

export type AccessStatus =
  | { kind: 'never' }
  | { kind: 'stale'; days: number }
  | { kind: 'recent'; days: number };

const DAY_MS = 24 * 3600 * 1000;

export const accessStatus = (lastSignInAt: string | null, now = Date.now()): AccessStatus => {
  if (!lastSignInAt) return { kind: 'never' };
  const days = Math.floor((now - new Date(lastSignInAt).getTime()) / DAY_MS);
  return days >= STALE_DAYS ? { kind: 'stale', days } : { kind: 'recent', days };
};

/** Texto curto para a lista (só para quem precisa de atenção). */
export const accessLabel = (status: AccessStatus): string | null =>
  status.kind === 'never'
    ? 'Nunca entrou na app'
    : status.kind === 'stale'
      ? `Não entra há ${status.days} dias`
      : null;
