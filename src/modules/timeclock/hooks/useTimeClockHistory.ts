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
export const useTimeClockHistory = (
  days: number,
  employeeIds: string[] | null = null
): UseTimeClockHistoryResult => {
  const [items, setItems] = useState<TimeClockHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chave estável: a lista nova a cada render não pode voltar a consultar.
  const idsKey = employeeIds ? [...employeeIds].sort().join(',') : null;
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await timeClockService.getHistory({
      fromIso: addDays(new Date(), -days).toISOString(),
      employeeIds: idsKey === null ? null : idsKey.split(',').filter(Boolean),
    });
    if (fetchError) setError('Erro ao carregar o histórico');
    else setItems(data);
    setIsLoading(false);
  }, [days, idsKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { items, isLoading, error, refetch: fetchHistory };
};
