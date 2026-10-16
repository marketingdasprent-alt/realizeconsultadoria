// Estado partilhado da jornada (relógio no cabeçalho, painel do ponto e página da
// tag): registos recentes do colaborador e a ação em curso.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, startOfDay } from 'date-fns';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { ACTION_ENTRY, deriveWorkday, type WorkdayAction } from '@/lib/workday';
import { useCurrentEmployee } from '../hooks/useCurrentEmployee';
import { useNow } from '../hooks/useNow';
import { usePunch } from '../hooks/usePunch';
import { markPunched, shouldRefreshOnVisible } from '../lib/refreshPolicy';
import { timeClockService } from '../services/timeClockService';
import { WorkdayContext, type RunOptions, type WorkdayContextValue } from './workdayContext';

/**
 * Registo provisório, mostrado logo ao carregar no botão: o servidor (GPS, VPN, regras) leva
 * alguns segundos e o estado/linha do dia não deve esperar por isso. Sai quando a resposta
 * chega (substituído pelo registo real, ou retirado se for recusado).
 */
const optimisticEntry = (
  action: WorkdayAction,
  employeeId: string
): TimeClockEntryWithRelations => {
  const now = new Date().toISOString();
  const { entryType, kind } = ACTION_ENTRY[action];
  return {
    id: `a-registar-${Date.now()}`,
    employee_id: employeeId,
    entry_type: entryType,
    kind,
    punched_at: now,
    created_at: now,
    status: 'approved',
    flags: [],
    source: 'gps',
    latitude: null,
    longitude: null,
    // Legenda na linha do dia enquanto o servidor confirma.
    address: 'A registar…',
    location: null,
  } as TimeClockEntryWithRelations;
};

/** Um erro de registo fica visível este tempo (ou até ao registo seguinte). */
const OUTCOME_VISIBLE_MS = 60 * 1000;

export const WorkdayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employee, isLoading: employeeLoading } = useCurrentEmployee();
  const [entries, setEntries] = useState<TimeClockEntryWithRelations[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const { phase, outcome, isBusy, punch, warmUp, clear } = usePunch();
  const now = useNow(30_000);
  const employeeId = employee?.id ?? null;
  const loadedAt = useRef(0);

  const refetch = useCallback(async () => {
    if (!employeeId) return;
    const today = startOfDay(new Date());
    const { data, error } = await timeClockService.getMyEntries(
      employeeId,
      addDays(today, -1).toISOString(),
      addDays(today, 2).toISOString()
    );
    if (!error) {
      setEntries(data);
      loadedAt.current = Date.now();
    }
    setEntriesLoaded(true);
  }, [employeeId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Ao voltar à app: só se já passou algum tempo ou se houve um registo noutra janela
  // (ex.: tag aberta no browser). Trocar de separador não volta a pedir os registos.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && shouldRefreshOnVisible(loadedAt.current))
        refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(clear, OUTCOME_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [outcome, clear]);

  const run = useCallback(
    async (action: WorkdayAction, options: RunOptions = {}) => {
      // Na hora: o estado e a linha do dia mudam já (não para horas corrigidas, que vão a aprovação).
      const provisional = employeeId && !options.at ? optimisticEntry(action, employeeId) : null;
      if (provisional) setEntries(list => [...list, provisional]);
      const result = await punch({
        action,
        method: options.method ?? 'gps',
        note: options.note,
        tag: options.tag,
        at: options.at,
      });
      // Registado, ou o ecrã estava desatualizado: recarrega para mostrar o estado real.
      if (result && (result.entry || result.code === 'invalid_state')) {
        if (result.entry) markPunched();
        await refetch();
        setVersion(v => v + 1);
      } else if (provisional) {
        // Recusado ou sem rede: desfaz (a mensagem do motivo aparece no painel).
        setEntries(list => list.filter(e => e.id !== provisional.id));
      }
      return result;
    },
    [punch, refetch, employeeId]
  );

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
      warmUp,
      refetch,
      version,
    ]
  );

  return <WorkdayContext.Provider value={value}>{children}</WorkdayContext.Provider>;
};
