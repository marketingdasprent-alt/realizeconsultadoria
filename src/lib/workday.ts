// Jornada de trabalho como no Bitrix24: Iniciar dia → Pausa ⇄ Retomar → Terminar dia
// (e "Retomar dia" se terminou por engano). Cada ação é um registo em
// time_clock_entries (entry_type + kind). Quem valida a sequência é a BD
// (time_clock_register_punch); aqui só se deriva o estado para mostrar o relógio,
// os botões e os nomes dos registos.
import { format } from 'date-fns';
import {
  MAX_SHIFT_MS,
  type EntryType,
  type TimeClockEntry,
  type TimeClockEntryWithRelations,
} from './timeclock';

export type WorkdayAction = 'start' | 'pause' | 'resume' | 'stop';
/** closed = dia por iniciar ou já terminado; working = a trabalhar; paused = em pausa. */
export type WorkdayStatus = 'closed' | 'working' | 'paused';
export type EntryKind = 'work' | 'break';

type EntryLike = Pick<TimeClockEntry, 'entry_type' | 'kind'>;

export const WORKDAY_ACTIONS: WorkdayAction[] = ['start', 'pause', 'resume', 'stop'];

/** Como cada ação fica gravada. */
export const ACTION_ENTRY: Record<WorkdayAction, { entryType: EntryType; kind: EntryKind }> = {
  start: { entryType: 'in', kind: 'work' },
  pause: { entryType: 'out', kind: 'break' },
  resume: { entryType: 'in', kind: 'break' },
  stop: { entryType: 'out', kind: 'work' },
};

export const getEntryAction = (entry: EntryLike): WorkdayAction => {
  const isBreak = entry.kind === 'break';
  if (entry.entry_type === 'in') return isBreak ? 'resume' : 'start';
  return isBreak ? 'pause' : 'stop';
};

/** Texto dos botões. */
export const ACTION_BUTTON_LABELS: Record<WorkdayAction, string> = {
  start: 'Iniciar dia',
  pause: 'Pausa',
  resume: 'Retomar',
  stop: 'Terminar dia',
};

/** Nome do registo nas listas, no histórico e na folha. */
export const ACTION_EVENT_LABELS: Record<WorkdayAction, string> = {
  start: 'Início',
  pause: 'Pausa',
  resume: 'Retoma',
  stop: 'Fim',
};

export const getEntryLabel = (entry: EntryLike): string =>
  ACTION_EVENT_LABELS[getEntryAction(entry)];

/** Texto do botão: "Retomar dia" quando se retoma um dia já terminado. */
export const getActionLabel = (action: WorkdayAction, status: WorkdayStatus): string =>
  action === 'resume' && status === 'closed' ? 'Retomar dia' : ACTION_BUTTON_LABELS[action];

const timeOf = (entry: { punched_at: string }) => new Date(entry.punched_at).getTime();

const isStop = (entry: EntryLike) => entry.entry_type === 'out' && entry.kind !== 'break';

/** Estado a partir do último registo (12 h sem registos = dia terminado, como na BD). */
export const getWorkdayStatus = (
  last: (EntryLike & { punched_at: string }) | null,
  now: Date = new Date()
): WorkdayStatus => {
  if (!last || now.getTime() - timeOf(last) >= MAX_SHIFT_MS) return 'closed';
  if (last.entry_type === 'in') return 'working';
  return last.kind === 'break' ? 'paused' : 'closed';
};

export interface Workday<T extends TimeClockEntry = TimeClockEntry> {
  status: WorkdayStatus;
  /** Último registo que conta (não anulado). */
  last: T | null;
  /** Desde quando está a trabalhar ou em pausa. */
  since: string | null;
  /** Primeiro início de hoje (ou do dia em curso, se começou ontem). */
  startedAt: string | null;
  /** Hora a que terminou o dia, se já terminou hoje. */
  endedAt: string | null;
  /** Terminou o dia hoje: pode retomá-lo (o fim passa a pausa), como no Bitrix24. */
  canContinue: boolean;
  /** Tempo trabalhado e em pausa até `now` (o segmento em curso conta). */
  workedMs: number;
  breakMs: number;
  /** Registos de hoje / do dia em curso, por ordem. */
  entries: T[];
}

/** Ações possíveis em cada estado (a mesma regra da BD). */
export const getAllowedActions = (
  workday: Pick<Workday, 'status' | 'canContinue'>
): WorkdayAction[] => {
  if (workday.status === 'working') return ['pause', 'stop'];
  if (workday.status === 'paused') return ['resume', 'stop'];
  return workday.canContinue ? ['resume'] : ['start'];
};

/** Divide os registos em dias de trabalho: de um início até ao fim (ou 12 h sem nada). */
const splitSessions = <T extends TimeClockEntry>(live: T[]): T[][] => {
  const sessions: T[][] = [];
  let current: T[] | null = null;
  let previous: T | null = null;
  for (const entry of live) {
    if (!current || (previous && timeOf(entry) - timeOf(previous) >= MAX_SHIFT_MS)) {
      current = [];
      sessions.push(current);
    }
    current.push(entry);
    if (isStop(entry)) current = null;
    previous = entry;
  }
  return sessions;
};

/** Soma o trabalho (entrada → saída) e as pausas (pausa → retoma) de um dia. */
const sumSession = (session: TimeClockEntry[], nowMs: number | null) => {
  let workedMs = 0;
  let breakMs = 0;
  let workingFrom: number | null = null;
  let pausedFrom: number | null = null;
  for (const entry of session) {
    const t = timeOf(entry);
    if (entry.entry_type === 'in') {
      if (pausedFrom !== null) breakMs += t - pausedFrom;
      pausedFrom = null;
      workingFrom = t; // duas entradas seguidas: conta a partir da mais recente
    } else {
      if (workingFrom !== null) workedMs += t - workingFrom;
      workingFrom = null;
      pausedFrom = entry.kind === 'break' ? t : null;
    }
  }
  if (nowMs !== null) {
    if (workingFrom !== null) workedMs += Math.max(0, nowMs - workingFrom);
    if (pausedFrom !== null) breakMs += Math.max(0, nowMs - pausedFrom);
  }
  return { workedMs, breakMs };
};

/**
 * Estado da jornada para o relógio: a trabalhar / em pausa / fora, tempo de hoje
 * e os registos do dia. Registos anulados não contam.
 */
export const deriveWorkday = <T extends TimeClockEntry>(
  entries: T[],
  now: Date = new Date()
): Workday<T> => {
  const live = entries.filter(e => e.status !== 'voided').sort((a, b) => timeOf(a) - timeOf(b));
  const last = live[live.length - 1] ?? null;
  const status = getWorkdayStatus(last, now);
  const sessions = splitSessions(live);
  const open = status !== 'closed' ? sessions[sessions.length - 1] : null;
  const todayKey = format(now, 'yyyy-MM-dd');
  const isToday = (entry: T) => format(new Date(entry.punched_at), 'yyyy-MM-dd') === todayKey;
  const today = sessions.filter(s => s === open || isToday(s[0]));

  let workedMs = 0;
  let breakMs = 0;
  for (const session of today) {
    const sums = sumSession(session, session === open ? now.getTime() : null);
    workedMs += sums.workedMs;
    breakMs += sums.breakMs;
  }

  const todayEntries = today.flat();
  const lastToday = todayEntries[todayEntries.length - 1];
  return {
    status,
    last,
    since: status !== 'closed' && last ? last.punched_at : null,
    startedAt: todayEntries[0]?.punched_at ?? null,
    endedAt: status === 'closed' && lastToday && isStop(lastToday) ? lastToday.punched_at : null,
    // A mesma regra da BD: o fim do dia foi hoje e há menos de 12 h.
    canContinue:
      status === 'closed' &&
      !!last &&
      isStop(last) &&
      isToday(last) &&
      now.getTime() - timeOf(last) < MAX_SHIFT_MS,
    workedMs,
    breakMs,
    entries: todayEntries,
  };
};

/** Cronómetro "HH:MM:SS". */
export const formatTimer = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map(n => String(n).padStart(2, '0')).join(':');
};

/**
 * Registo esquecido (✎): a hora indicada ("14:00") tem de ser de hoje, antes de agora,
 * nas últimas 12 h e depois do último registo. O motivo é opcional: com ele o registo fica
 * válido; sem ele os RH aprovam.
 */
export const buildCorrection = (
  time: string,
  _reason: string,
  last: { punched_at: string } | null,
  now: Date = new Date()
): { at: string } | { error: string } => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return { error: 'Indique a hora.' };
  const at = new Date(now);
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (at.getTime() > now.getTime()) return { error: 'A hora não pode ser no futuro.' };
  if (now.getTime() - at.getTime() > MAX_SHIFT_MS) {
    return { error: 'Só é possível corrigir as últimas 12 horas. Fale com os RH.' };
  }
  if (last && at.getTime() <= timeOf(last)) {
    return {
      error: `Tem de ser depois do último registo (${format(new Date(last.punched_at), 'HH:mm')}).`,
    };
  }
  return { at: at.toISOString() };
};

/** O colaborador indicou a hora deste registo (✎): os RH confirmam. */
export const isManualTime = (entry: Pick<TimeClockEntry, 'flags'>): boolean =>
  entry.flags.includes('manual_time');

/**
 * Onde foi feito o registo, para o colaborador: o local de trabalho, a morada
 * aproximada (OpenStreetMap) ou "Sem localização" quando não houve GPS.
 */
export const getEntryPlace = (entry: TimeClockEntryWithRelations): string | null => {
  if (entry.location?.name) return entry.location.name;
  if (entry.address) return entry.address;
  if (entry.source !== 'admin' && entry.latitude === null) return 'Sem localização';
  return null;
};
