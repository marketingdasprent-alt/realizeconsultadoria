import { useCallback, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { timeClockService, type TimeClockAttemptWithRelations } from '../services/timeClockService';

export interface UseTimeClockReviewResult {
  /** Trabalho remoto a aguardar aprovação. */
  pending: TimeClockEntryWithRelations[];
  /** Aceites mas com alertas (VPN, IP longe, GPS suspeito...). */
  flagged: TimeClockEntryWithRelations[];
  attempts: TimeClockAttemptWithRelations[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Registos a aprovar / em revisão (últimos 90 dias) e tentativas rejeitadas (últimos 30 dias).
 */
export const useTimeClockReview = (enabled = true): UseTimeClockReviewResult => {
  const [pending, setPending] = useState<TimeClockEntryWithRelations[]>([]);
  const [flagged, setFlagged] = useState<TimeClockEntryWithRelations[]>([]);
  const [attempts, setAttempts] = useState<TimeClockAttemptWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    const now = new Date();
    const from = addDays(now, -90).toISOString();
    const tomorrow = addDays(now, 1).toISOString();
    const [pendingRes, flaggedRes, attemptsRes] = await Promise.all([
      timeClockService.getEntries({ fromIso: from, toIso: tomorrow, status: 'pending' }),
      timeClockService.getEntries({ fromIso: from, toIso: tomorrow, status: 'flagged' }),
      timeClockService.getAttempts(addDays(now, -30).toISOString(), tomorrow),
    ]);
    if (pendingRes.error || flaggedRes.error || attemptsRes.error) {
      setError('Erro ao carregar registos para revisão');
    }
    setPending([...pendingRes.data].reverse());
    setFlagged([...flaggedRes.data].reverse());
    setAttempts(attemptsRes.data);
    setIsLoading(false);
  }, [enabled]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { pending, flagged, attempts, isLoading, error, refetch: fetchAll };
};
