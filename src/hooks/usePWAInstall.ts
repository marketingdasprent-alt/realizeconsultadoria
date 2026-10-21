import { useEffect, useState } from 'react';
import {
  getInstallState,
  promptInstall,
  subscribeInstall,
  type InstallState,
} from '@/lib/pwa-install';

interface PWAInstallHook extends InstallState {
  promptInstall: () => Promise<boolean>;
}

/** Instalar a app: o pedido do browser fica guardado desde o arranque (lib/pwa-install). */
export function usePWAInstall(): PWAInstallHook {
  const [state, setState] = useState<InstallState>(getInstallState);

  useEffect(() => {
    const update = () => setState(getInstallState());
    update();
    return subscribeInstall(update);
  }, []);

  return { ...state, promptInstall };
}
