import { isNativeApp } from './nativeApp';
// Pedido de instalação do browser (Chrome/Edge no Android, Windows e Mac). Chega uma vez,
// logo ao abrir o site — muitas vezes antes de existir a página com o botão "Instalar" —, por
// isso fica guardado aqui desde o arranque (startInstallCapture em main.tsx).
// O iPhone não tem este pedido: instala-se em Partilhar → "Adicionar ao ecrã principal".

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** A app já está aberta como app instalada (ecrã inteiro, sem barra do browser). */
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

export const startInstallCapture = (): void => {
  window.addEventListener('beforeinstallprompt', event => {
    // Sem a barra automática do Chrome: instala-se pelo botão da app.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installedNow = true;
    deferred = null;
    notify();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', notify);
};

export interface InstallState {
  /** O browser deixa instalar já, com um clique (botão "Instalar"). */
  canInstall: boolean;
  isInstalled: boolean;
}

export const getInstallState = (): InstallState => {
  // Na app Android já está "instalada".
  const isInstalled = installedNow || isStandalone() || isNativeApp();
  return { canInstall: !!deferred && !isInstalled, isInstalled };
};

export const subscribeInstall = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Abre a janela de instalação do browser. `true` = instalou. */
export const promptInstall = async (): Promise<boolean> => {
  const event = deferred;
  if (!event) return false;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // O pedido só serve uma vez.
    deferred = null;
    notify();
    return outcome === 'accepted';
  } catch (error: unknown) {
    console.error('[PWA] Erro ao instalar:', error);
    return false;
  }
};
