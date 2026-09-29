import { useCallback, useEffect, useState } from 'react';
import type { HomeData } from '@/lib/employee-home';
import { employeeHomeService } from '../services/employeeHomeService';

interface UseEmployeeHomeResult {
  data: HomeData | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Dados do ecrã Início; volta a carregar quando a app regressa ao primeiro plano.
 */
export const useEmployeeHome = (companyId: string, employeeId: string): UseEmployeeHomeResult => {
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: home } = await employeeHomeService.getHomeData(companyId, employeeId);
    setData(home);
    setIsLoading(false);
  }, [companyId, employeeId]);

  useEffect(() => {
    fetchData();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchData]);

  return { data, isLoading, refetch: fetchData };
};
