import { useCallback, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import type { TimeClockConfigHistory } from '@/lib/timeclock';
import { timeClockService } from '../services/timeClockService';

interface UseTimeClockConfigHistoryResult {
  items: TimeClockConfigHistory[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Alterações a locais e tags nos últimos `days` dias (só carrega quando `enabled`).
 */
export const useTimeClockConfigHistory = (
  days: number,
  enabled: boolean
): UseTimeClockConfigHistoryResult => {
  const [items, setItems] = useState<TimeClockConfigHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await timeClockService.getConfigHistory(
      addDays(new Date(), -days).toISOString()
    );
    if (fetchError) setError('Erro ao carregar o histórico de configuração');
    else setItems(data);
    setIsLoading(false);
  }, [days, enabled]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { items, isLoading, error };
};
