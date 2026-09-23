import { useCallback, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import type { TimeClockHistory } from '@/lib/timeclock';
import { timeClockService } from '../services/timeClockService';

interface UseTimeClockHistoryResult {
  items: TimeClockHistory[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Alterações à folha de ponto nos últimos `days` dias (mais recentes primeiro).
 */
export const useTimeClockHistory = (days: number): UseTimeClockHistoryResult => {
  const [items, setItems] = useState<TimeClockHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await timeClockService.getHistory({
      fromIso: addDays(new Date(), -days).toISOString(),
    });
    if (fetchError) setError('Erro ao carregar o histórico');
    else setItems(data);
    setIsLoading(false);
  }, [days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { items, isLoading, error, refetch: fetchHistory };
};
