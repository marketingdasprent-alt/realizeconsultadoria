import { useCallback, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { timeClockService, type TimeClockAttemptWithRelations } from '../services/timeClockService';

interface UseTimeClockReviewResult {
  flagged: TimeClockEntryWithRelations[];
  attempts: TimeClockAttemptWithRelations[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Registos em revisão (últimos 90 dias) e tentativas rejeitadas (últimos 30 dias).
 */
export const useTimeClockReview = (): UseTimeClockReviewResult => {
  const [flagged, setFlagged] = useState<TimeClockEntryWithRelations[]>([]);
  const [attempts, setAttempts] = useState<TimeClockAttemptWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const now = new Date();
    const tomorrow = addDays(now, 1).toISOString();
    const [flaggedRes, attemptsRes] = await Promise.all([
      timeClockService.getEntries({
        fromIso: addDays(now, -90).toISOString(),
        toIso: tomorrow,
        status: 'flagged',
      }),
      timeClockService.getAttempts(addDays(now, -30).toISOString(), tomorrow),
    ]);
    if (flaggedRes.error || attemptsRes.error) setError('Erro ao carregar registos para revisão');
    setFlagged([...flaggedRes.data].reverse());
    setAttempts(attemptsRes.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { flagged, attempts, isLoading, error, refetch: fetchAll };
};
