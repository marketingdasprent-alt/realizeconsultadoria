// Contexto da jornada: tipos e objeto partilhados pelo provider e pelos hooks.
import { createContext } from 'react';
import type { TagPayload } from '@/lib/nfc';
import type { PunchMethod, TimeClockEntryWithRelations } from '@/lib/timeclock';
import type { Workday, WorkdayAction } from '@/lib/workday';
import type { PunchOutcome, PunchPhase } from '../hooks/usePunch';
import type { CurrentEmployee } from '../services/timeClockService';

export interface RunOptions {
  note?: string;
  method?: PunchMethod;
  tag?: TagPayload;
  /** Hora de um registo esquecido (ISO); a nota é o motivo. */
  at?: string;
}

export interface WorkdayContextValue {
  employee: CurrentEmployee | null;
  isLoading: boolean;
  /** Registos desde ontem (chega para o dia em curso e para turnos noturnos). */
  entries: TimeClockEntryWithRelations[];
  workday: Workday<TimeClockEntryWithRelations>;
  phase: PunchPhase;
  outcome: PunchOutcome | null;
  isBusy: boolean;
  run: (action: WorkdayAction, options?: RunOptions) => Promise<PunchOutcome | null>;
  warmUp: () => void;
  refetch: () => Promise<void>;
  /** Muda a cada registo novo (para outras listas recarregarem). */
  version: number;
}

export const WorkdayContext = createContext<WorkdayContextValue | null>(null);
