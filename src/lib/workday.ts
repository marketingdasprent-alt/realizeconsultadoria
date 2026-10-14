// Jornada de trabalho como no Bitrix24: Iniciar dia → Pausa ⇄ Retomar → Terminar dia.
// Cada ação é um registo em time_clock_entries (entry_type + kind). Quem valida a
// sequência é a BD (time_clock_register_punch); aqui só se deriva o estado para
// mostrar o relógio, os botões e os nomes dos registos.
import { format } from 'date-fns';
import {
  MAX_SHIFT_MS,
  NO_NEARBY_LOCATION_M,
  formatDistance,
  type EntryType,
  type TimeClockEntry,
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

/** Confirmação depois de registar. */
export const ACTION_DONE_LABELS: Record<WorkdayAction, string> = {
  start: 'Dia iniciado',
  pause: 'Pausa iniciada',
  resume: 'Trabalho retomado',
  stop: 'Dia terminado',
};

export const getEntryLabel = (entry: EntryLike): string =>
  ACTION_EVENT_LABELS[getEntryAction(entry)];

/** Ações possíveis em cada estado (a mesma regra da BD). */
export const ALLOWED_ACTIONS: Record<WorkdayStatus, WorkdayAction[]> = {
  closed: ['start'],
  working: ['pause', 'stop'],
  paused: ['resume', 'stop'],
};

/** O colaborador pode desfazer o último registo durante este tempo (a BD aceita 3 min). */
export const UNDO_WINDOW_MS = 170 * 1000;

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
  /** Tempo trabalhado e em pausa até `now` (o segmento em curso conta). */
  workedMs: number;
  breakMs: number;
  /** Registos de hoje / do dia em curso, por ordem. */
  entries: T[];
}

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
  const today = sessions.filter(
    s => s === open || format(new Date(s[0].punched_at), 'yyyy-MM-dd') === todayKey
  );

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

/** Porque é que o registo ficou a aguardar aprovação (mostrado ao colaborador). */
export const getPendingReason = (
  flags: string[],
  distanceM?: number | null,
  locationName?: string | null
): string => {
  if (flags.includes('no_gps')) {
    return 'Não foi possível obter a sua localização (GPS desligado ou sem permissão).';
  }
  if (flags.includes('stale_gps')) return 'A localização do telemóvel estava desatualizada.';
  if (flags.includes('approximate_location')) {
    return 'O telemóvel só enviou a localização aproximada (erra mais de 1 km).';
  }
  if (flags.includes('weak_gps')) return 'O sinal GPS estava fraco para confirmar o local.';
  if (flags.includes('tag_required')) {
    return 'Neste local o ponto faz-se encostando o telemóvel à tag.';
  }
  if (flags.includes('no_location_configured')) {
    return 'A sua empresa ainda não tem locais de ponto configurados.';
  }
  if (typeof distanceM === 'number' && Number.isFinite(distanceM)) {
    if (distanceM >= NO_NEARBY_LOCATION_M) {
      const nearest = locationName
        ? ` (o mais próximo, ${locationName}, fica a ${formatDistance(distanceM)})`
        : '';
      return `Não há nenhum local de trabalho registado perto de si${nearest}. Se está no seu local habitual, avise os RH para o adicionarem.`;
    }
    const where = locationName ? ` de ${locationName}` : ' do local de trabalho';
    return `Está a ${formatDistance(distanceM)}${where}, fora do raio.`;
  }
  return 'Está fora do local de trabalho.';
};

/** O que fazer para o próximo registo ficar validado logo. */
export const getPendingTip = (flags: string[]): string | null => {
  if (flags.includes('no_gps') || flags.includes('stale_gps')) {
    return 'Ligue a localização (GPS) e permita o acesso à localização para o ponto ficar validado logo.';
  }
  if (flags.includes('approximate_location')) {
    return 'iPhone: Definições → Privacidade e segurança → Serviços de localização → Safari (ou Realize) → ative "Localização exata". Android: Definições → Localização → ative "Localização precisa".';
  }
  if (flags.includes('weak_gps')) return 'Aproxime-se de uma janela ou encoste o telemóvel à tag.';
  return null;
};
