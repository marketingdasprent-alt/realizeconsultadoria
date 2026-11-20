import { useEffect, useState } from 'react';
import {
  readDeviceCache,
  sessionChangedSince,
  sessionUserId,
  writeDeviceCacheIfSession,
} from '@/lib/device-cache';
import { timeClockService, type CurrentEmployee } from '../services/timeClockService';

interface UseCurrentEmployeeResult {
  employee: CurrentEmployee | null;
  isLoading: boolean;
}

const CACHE = 'current-employee';

/**
 * Colaborador da sessão atual. O da última vez (guardado no aparelho) aparece já; a resposta
 * do servidor substitui-o.
 */
export const useCurrentEmployee = (): UseCurrentEmployeeResult => {
  const [cached] = useState(() => readDeviceCache<CurrentEmployee>(CACHE, sessionUserId()));
  const [employee, setEmployee] = useState<CurrentEmployee | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const requester = sessionUserId();
      timeClockService.getCurrentEmployee().then(({ data, error }) => {
        if (cancelled) return;
        // A conta mudou durante o pedido: a resposta é da anterior, pede-se de novo.
        if (sessionChangedSince(requester)) {
          load();
          return;
        }
        // Sem rede: fica o guardado.
        if (!error) {
          setEmployee(data);
          writeDeviceCacheIfSession(CACHE, requester, data);
        }
        setIsLoading(false);
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { employee, isLoading };
};
