import { useEffect, useState } from 'react';

/**
 * Hora atual, atualizada a cada `intervalMs` (e ao voltar à app, para o relógio
 * não ficar parado depois de o telemóvel adormecer).
 */
export const useNow = (intervalMs = 1000): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
};
