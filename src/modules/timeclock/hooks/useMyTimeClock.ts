import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import {
  getNextEntryType,
  summarizeDays,
  type DaySummary,
  type EntryType,
  type TimeClockEntryWithRelations,
} from '@/lib/timeclock';
import { timeClockService } from '../services/timeClockService';

interface UseMyTimeClockResult {
  entries: TimeClockEntryWithRelations[];
  days: DaySummary[];
  today: DaySummary | null;
  lastEntry: TimeClockEntryWithRelations | null;
  nextType: EntryType;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Registos do mês corrente do colaborador (inclui o último dia do mês
 * anterior para turnos que atravessam a meia-noite).
 */
export const useMyTimeClock = (employeeId: string | null): UseMyTimeClockResult => {
  const [entries, setEntries] = useState<TimeClockEntryWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    const now = new Date();
    const from = addDays(startOfMonth(now), -1);
    const to = addDays(now, 1);
    const { data, error: fetchError } = await timeClockService.getMyEntries(
      employeeId,
      from.toISOString(),
      to.toISOString()
    );
    if (fetchError) setError('Erro ao carregar os registos de ponto');
    else setEntries(data);
    setIsLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const derived = useMemo(() => {
    const days = summarizeDays(entries);
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const lastEntry = entries.find(e => e.status !== 'voided') ?? null; // lista vem desc
    return {
      days,
      today: days.find(d => d.date === todayKey) ?? null,
      lastEntry,
      nextType: getNextEntryType(lastEntry),
    };
  }, [entries]);

  return { entries, ...derived, isLoading, error, refetch: fetchEntries };
};
