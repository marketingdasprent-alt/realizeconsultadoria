// Jornada de exemplo para a pré-visualização (sem sessão): os botões do ponto
// funcionam só em memória, nada é enviado para a base de dados.
import React, { useCallback, useMemo, useState } from 'react';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { ACTION_ENTRY, deriveWorkday, type WorkdayAction } from '@/lib/workday';
import {
  WorkdayContext,
  type RunOptions,
  type WorkdayContextValue,
} from '@/modules/timeclock/context/workdayContext';
import { useNow } from '@/modules/timeclock/hooks/useNow';

const EMPLOYEE = {
  id: 'preview',
  name: 'Joana Silva',
  company_id: 'preview',
  companies: { name: 'Realize Consultadoria' },
};

// Horas relativas a agora: o exemplo bate sempre certo com o relógio.
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const makeEntry = (action: WorkdayAction, punchedAt: string): TimeClockEntryWithRelations => ({
  id: `preview-${action}-${punchedAt}`,
  employee_id: EMPLOYEE.id,
  company_id: EMPLOYEE.company_id,
  entry_type: ACTION_ENTRY[action].entryType,
  kind: ACTION_ENTRY[action].kind,
  punched_at: punchedAt,
  source: 'gps',
  status: 'valid',
  work_mode: 'onsite',
  flags: [],
  address: null,
  accuracy_m: 12,
  distance_m: 8,
  latitude: null,
  longitude: null,
  location_id: null,
  location: { name: 'Escritório Lisboa' },
  device_id: null,
  ip_address: null,
  ip_city: null,
  ip_country: null,
  ip_is_proxy: null,
  notes: null,
  employee_note: null,
  tag_id: null,
  user_agent: null,
  created_at: punchedAt,
  created_by: null,
  updated_at: punchedAt,
  updated_by: null,
});

const INITIAL = [
  makeEntry('start', minutesAgo(205)),
  makeEntry('pause', minutesAgo(118)),
  makeEntry('resume', minutesAgo(64)),
];

export const PreviewWorkdayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState(INITIAL);
  const [version, setVersion] = useState(0);
  const now = useNow(30_000);

  const run = useCallback(async (action: WorkdayAction, options: RunOptions = {}) => {
    const entry = makeEntry(action, options.at ?? new Date().toISOString());
    setEntries(current => [...current, entry]);
    setVersion(v => v + 1);
    return { ok: true, code: 'ok', action, message: 'Registado', entry: null, state: null };
  }, []);

  const workday = useMemo(() => deriveWorkday(entries, now), [entries, now]);

  const value = useMemo<WorkdayContextValue>(
    () => ({
      employee: EMPLOYEE,
      isLoading: false,
      entries,
      workday,
      phase: 'idle',
      outcome: null,
      isBusy: false,
      run,
      warmUp: () => undefined,
      refetch: async () => undefined,
      version,
    }),
    [entries, workday, run, version]
  );

  return <WorkdayContext.Provider value={value}>{children}</WorkdayContext.Provider>;
};
