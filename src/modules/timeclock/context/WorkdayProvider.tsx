// Estado partilhado da jornada (relógio no cabeçalho, painel do ponto e página da
// tag): registos recentes do colaborador, a ação em curso e o "Desfazer".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { getErrorMessage, type TimeClockEntryWithRelations } from '@/lib/timeclock';
import { UNDO_WINDOW_MS, deriveWorkday, type WorkdayAction } from '@/lib/workday';
import { useCurrentEmployee } from '../hooks/useCurrentEmployee';
import { useNow } from '../hooks/useNow';
import { usePunch } from '../hooks/usePunch';
import { timeClockService } from '../services/timeClockService';
import { WorkdayContext, type RunOptions, type WorkdayContextValue } from './workdayContext';

export const WorkdayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employee, isLoading: employeeLoading } = useCurrentEmployee();
  const [entries, setEntries] = useState<TimeClockEntryWithRelations[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const { phase, outcome, isBusy, punch, warmUp, clear } = usePunch();
  const now = useNow(30_000);
  const employeeId = employee?.id ?? null;

  const refetch = useCallback(async () => {
    if (!employeeId) return;
    const today = startOfDay(new Date());
    const { data, error } = await timeClockService.getMyEntries(
      employeeId,
      addDays(today, -1).toISOString(),
      addDays(today, 2).toISOString()
    );
    if (!error) setEntries(data);
    setEntriesLoaded(true);
  }, [employeeId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Ao voltar à app (ex.: depois de registar na tag, que pode abrir no browser).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  // O resultado (e o "Desfazer") desaparece ao fim de 3 minutos.
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(clear, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [outcome, clear]);

  const changed = useCallback(async () => {
    await refetch();
    setVersion(v => v + 1);
  }, [refetch]);

  const run = useCallback(
    async (action: WorkdayAction, options: RunOptions = {}) => {
      const result = await punch({
        action,
        method: options.method ?? 'gps',
        note: options.note,
        tag: options.tag,
      });
      // Registado, ou o ecrã estava desatualizado: recarrega para mostrar o estado real.
      if (result && (result.entry || result.code === 'invalid_state')) await changed();
      return result;
    },
    [punch, changed]
  );

  const undo = useCallback(async (): Promise<string | null> => {
    const entry = outcome?.entry;
    if (!entry) return 'Não há registo para desfazer.';
    const { error } = await timeClockService.undoOwnEntry(entry.id);
    if (error) return getErrorMessage(error, 'Não foi possível desfazer o registo.');
    clear();
    await changed();
    return null;
  }, [outcome, clear, changed]);

  const workday = useMemo(() => deriveWorkday(entries, now), [entries, now]);

  const value = useMemo<WorkdayContextValue>(
    () => ({
      employee,
      isLoading: employeeLoading || (!!employeeId && !entriesLoaded),
      entries,
      workday,
      phase,
      outcome,
      isBusy,
      run,
      undo,
      warmUp,
      refetch,
      version,
    }),
    [
      employee,
      employeeLoading,
      employeeId,
      entriesLoaded,
      entries,
      workday,
      phase,
      outcome,
      isBusy,
      run,
      undo,
      warmUp,
      refetch,
      version,
    ]
  );

  return <WorkdayContext.Provider value={value}>{children}</WorkdayContext.Provider>;
};
