import { useEffect, useState } from 'react';
import { timeClockService, type CurrentEmployee } from '../services/timeClockService';

interface UseCurrentEmployeeResult {
  employee: CurrentEmployee | null;
  isLoading: boolean;
}

/**
 * Colaborador da sessão atual.
 */
export const useCurrentEmployee = (): UseCurrentEmployeeResult => {
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    timeClockService.getCurrentEmployee().then(({ data }) => {
      if (cancelled) return;
      setEmployee(data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employee, isLoading };
};
