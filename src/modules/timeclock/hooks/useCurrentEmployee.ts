import { useEffect, useState } from 'react';
import { readDeviceCache, sessionUserId, writeDeviceCache } from '@/lib/device-cache';
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
    timeClockService.getCurrentEmployee().then(({ data, error }) => {
      if (cancelled) return;
      // Sem rede: fica o guardado.
      if (!error) {
        setEmployee(data);
        writeDeviceCache(CACHE, sessionUserId(), data);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employee, isLoading };
};
