// Largura da coluna das caixas e pastas: arrastar a margem direita; fica guardada neste aparelho.

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 250;
const KEY = 'rz.mail.sidebar-width';

export const clampSidebarWidth = (value: number): number =>
  Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));

export const readSidebarWidth = (): number => {
  try {
    const stored = Number(localStorage.getItem(KEY));
    return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
};

export const saveSidebarWidth = (width: number): void => {
  try {
    localStorage.setItem(KEY, String(clampSidebarWidth(width)));
  } catch {
    // sem armazenamento (janela privada): só perde a escolha
  }
};
