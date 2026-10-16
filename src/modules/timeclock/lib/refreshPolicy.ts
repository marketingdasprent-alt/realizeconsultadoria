// Quando recarregar os registos de ponto ao voltar à app: não a cada troca de separador
// (cada colaborador fazia dezenas de pedidos por dia sem nada mudar), mas sim se já passou
// algum tempo ou se houve um registo noutro sítio (ex.: tag NFC aberta no browser).

/** Intervalo mínimo entre recarregamentos ao voltar à app. */
export const VISIBLE_REFRESH_MS = 5 * 60_000;

const PUNCH_KEY = 'rz-last-punch-at';

/** Assinala um registo de ponto feito agora (lido pelas outras janelas da mesma origem). */
export const markPunched = (now: number = Date.now()): void => {
  try {
    localStorage.setItem(PUNCH_KEY, String(now));
  } catch {
    // sem armazenamento: as outras janelas recarregam pelo intervalo
  }
};

const lastPunchAt = (): number => {
  try {
    return Number(localStorage.getItem(PUNCH_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Recarregar ao voltar à app? Só se passou o intervalo ou houve um registo desde a última carga. */
export const shouldRefreshOnVisible = (
  lastLoadAt: number,
  now: number = Date.now(),
  punchedAt: number = lastPunchAt()
): boolean => now - lastLoadAt >= VISIBLE_REFRESH_MS || punchedAt > lastLoadAt;
