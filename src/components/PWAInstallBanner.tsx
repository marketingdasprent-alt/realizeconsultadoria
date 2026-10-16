import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Smartphone, Download } from 'lucide-react';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const STORAGE_KEY = 'pwa-banner-dismissed';
const DISMISS_DURATION_DAYS = 7;

const wasDismissed = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const daysPassed = (Date.now() - new Date(stored).getTime()) / (1000 * 60 * 60 * 24);
    return daysPassed < DISMISS_DURATION_DAYS;
  } catch {
    return false;
  }
};

/** Convite para instalar a app (escondido 7 dias depois de fechado). */
export const PWAInstallBanner = () => {
  const navigate = useNavigate();
  const device = useDeviceDetect();
  const { isInstalled } = usePWAInstall();
  const [dismissed, setDismissed] = useState(wasDismissed);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Sem armazenamento (modo privado): fica escondido só nesta visita.
    }
    setDismissed(true);
  };

  if (isInstalled || dismissed) return null;

  const Icon = device.isMobile ? Smartphone : Download;

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-rz-ink p-3 pr-2 text-white shadow-rz-soft sm:gap-4 sm:p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-5 w-5 text-[#F3D9A4]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {device.isMobile ? 'Instale a app para acesso rápido' : 'Instale a app no seu computador'}
        </p>
        <p className="text-[12.5px] text-white/60">Aceda mais rápido, mesmo offline</p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/instalar')}
        className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-rz-ink transition-colors hover:bg-white/90"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PWAInstallBanner;
