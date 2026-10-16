// Regras do ecrã "Novo pedido": que dias se podem escolher, o que já está ocupado e quantos
// dias tem cada período. A validação final (48 h, conflitos, pendentes) continua no hook.
import { addDays, eachDayOfInterval, format, isAfter, isWeekend, startOfDay } from 'date-fns';
import {
  calculateBusinessDaysFromHours,
  calculateHoursBetween,
  countBusinessDays,
  isHoliday,
  type DatePeriod,
  type Holiday,
} from '@/lib/vacation-utils';
import type { AbsenceRow } from './absenceRules';

/** Férias pedem comprovativo raramente; os outros motivos quase sempre. */
export const docsFirst = (type: string) => !!type && type !== 'vacation';

/** Férias só se pedem com 48 h de antecedência; os outros motivos são imprevisíveis. */
export const noticeFor = (type: string, now: Date = new Date()): Date | null =>
  type === 'vacation' ? addDays(startOfDay(now), 2) : null;

const key = (date: Date) => format(date, 'yyyy-MM-dd');

export interface BusyDays {
  approved: Date[];
  pending: Date[];
}

/**
 * Dias de dia completo já ocupados por férias ou ausências aprovadas ou pendentes (os
 * períodos com horas não bloqueiam o dia: o conflito de horas vê-se ao submeter).
 */
export const busyDays = (absences: AbsenceRow[]): BusyDays => {
  const approved = new Map<string, Date>();
  const pending = new Map<string, Date>();
  for (const absence of absences) {
    if (!['approved', 'pending', 'partially_approved'].includes(absence.status)) continue;
    const periods = absence.absence_periods?.length
      ? absence.absence_periods
      : [
          {
            start_date: absence.start_date,
            end_date: absence.end_date,
            status: absence.status,
            period_type: 'full_day',
          },
        ];
    for (const period of periods) {
      if (period.status === 'rejected' || period.period_type === 'partial') continue;
      const target = period.status === 'approved' ? approved : pending;
      for (const day of eachDayOfInterval({
        start: new Date(`${period.start_date}T00:00:00`),
        end: new Date(`${period.end_date}T00:00:00`),
      }))
        target.set(key(day), day);
    }
  }
  return { approved: [...approved.values()], pending: [...pending.values()] };
};

/** Um dia que nunca se pode escolher: fim de semana, feriado ou sem a antecedência devida. */
export const isUnavailable = (
  date: Date,
  holidays: Holiday[],
  notice: Date | null,
  busy: BusyDays
): boolean =>
  isWeekend(date) ||
  !!isHoliday(date, holidays) ||
  (!!notice && date < notice) ||
  [...busy.approved, ...busy.pending].some(day => key(day) === key(date));

export const periodDays = (period: DatePeriod, holidays: Holiday[]): number =>
  period.periodType === 'partial' && period.startTime && period.endTime
    ? calculateBusinessDaysFromHours(calculateHoursBetween(period.startTime, period.endTime))
    : countBusinessDays(period.from, period.to, holidays);

export const totalDays = (periods: DatePeriod[], holidays: Holiday[]) =>
  periods.reduce((sum, period) => sum + periodDays(period, holidays), 0);

/** Dias de todos os períodos já escolhidos (para pintar e para não sobrepor). */
export const chosenDays = (periods: DatePeriod[]): Date[] =>
  periods.flatMap(period => eachDayOfInterval({ start: period.from, end: period.to }));

const isWorking = (day: Date, holidays: Holiday[]) => !isWeekend(day) && !isHoliday(day, holidays);

/** Tira os fins de semana e feriados das pontas (não contam e não devem aparecer escolhidos). */
const trim = (period: DatePeriod, holidays: Holiday[]): DatePeriod | null => {
  let { from, to } = period;
  while (from <= to && !isWorking(from, holidays)) from = addDays(from, 1);
  while (to >= from && !isWorking(to, holidays)) to = addDays(to, -1);
  return from <= to ? { ...period, from, to } : null;
};

/**
 * Períodos de dia completo seguidos juntam-se num só: se entre um e o seguinte só há fins de
 * semana ou feriados (e nada ocupado), é a mesma ausência. Os de horas ficam à parte.
 */
export const normalizePeriods = (
  periods: DatePeriod[],
  holidays: Holiday[],
  busy: BusyDays
): DatePeriod[] => {
  const taken = new Set([...busy.approved, ...busy.pending].map(key));
  const full = periods
    .filter(p => p.periodType === 'full_day')
    .map(p => trim(p, holidays))
    .filter((p): p is DatePeriod => !!p)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const merged: DatePeriod[] = [];
  for (const period of full) {
    const last = merged[merged.length - 1];
    const gap =
      last && isAfter(period.from, addDays(last.to, 1))
        ? eachDayOfInterval({ start: addDays(last.to, 1), end: addDays(period.from, -1) })
        : [];
    if (last && gap.every(day => !isWorking(day, holidays) && !taken.has(key(day)))) {
      if (period.to > last.to) last.to = period.to;
    } else {
      merged.push({ ...period });
    }
  }
  return [...merged, ...periods.filter(p => p.periodType === 'partial')].sort(
    (a, b) => a.from.getTime() - b.from.getTime()
  );
};

export const addPeriod = (
  periods: DatePeriod[],
  period: DatePeriod,
  holidays: Holiday[],
  busy: BusyDays
) => normalizePeriods([...periods, period], holidays, busy);

/** Tira um dia escolhido: encurta o período numa ponta ou parte-o em dois no meio. */
export const removeDay = (
  periods: DatePeriod[],
  day: Date,
  holidays: Holiday[],
  busy: BusyDays
): DatePeriod[] => {
  const next = periods.flatMap((period): DatePeriod[] => {
    if (day < period.from || day > period.to) return [period];
    if (period.periodType === 'partial') return [];
    return [
      { ...period, to: addDays(day, -1) },
      { ...period, from: addDays(day, 1) },
    ].filter(part => part.from <= part.to);
  });
  return normalizePeriods(next, holidays, busy);
};

/** Dias que se podem juntar num intervalo: úteis, livres e ainda não escolhidos. */
export const freeDaysBetween = (
  a: Date,
  b: Date,
  holidays: Holiday[],
  notice: Date | null,
  busy: BusyDays,
  periods: DatePeriod[]
): Date[] => {
  const [start, end] = a <= b ? [a, b] : [b, a];
  const chosen = new Set(chosenDays(periods).map(key));
  return eachDayOfInterval({ start, end }).filter(
    day => !isUnavailable(day, holidays, notice, busy) && !chosen.has(key(day))
  );
};

/** Junta dias soltos aos períodos: os seguidos formam um só. */
export const addDaysToPeriods = (
  periods: DatePeriod[],
  days: Date[],
  holidays: Holiday[],
  busy: BusyDays
): DatePeriod[] =>
  normalizePeriods(
    [
      ...periods,
      ...days.map((day): DatePeriod => ({ from: day, to: day, periodType: 'full_day' })),
    ],
    holidays,
    busy
  );
