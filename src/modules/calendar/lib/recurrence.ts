// Ocorrências de eventos recorrentes num intervalo (a BD guarda só a primeira).
import { addDays, addMonths, addWeeks, addYears, endOfDay } from 'date-fns';
import type { CalendarEvent } from '../types';

const STEP: Record<string, (date: Date, n: number) => Date> = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears,
};

/** Limite de segurança para não gerar ocorrências sem fim. */
const MAX_OCCURRENCES = 1000;

/**
 * Inícios/fins das ocorrências que tocam [from, to]. Um evento sem recorrência tem uma
 * só ocorrência. A recorrência acaba no fim do dia `recurrenceUntil`.
 */
export const expandOccurrences = (
  event: Pick<CalendarEvent, 'startsAt' | 'endsAt' | 'recurrence' | 'recurrenceUntil'>,
  from: Date,
  to: Date
): { start: Date; end: Date }[] => {
  const first = new Date(event.startsAt);
  const duration = new Date(event.endsAt).getTime() - first.getTime();
  const overlaps = (start: Date) => start <= to && start.getTime() + duration >= from.getTime();

  if (!event.recurrence) {
    return overlaps(first) ? [{ start: first, end: new Date(first.getTime() + duration) }] : [];
  }
  const step = STEP[event.recurrence];
  const until = event.recurrenceUntil
    ? endOfDay(new Date(`${event.recurrenceUntil}T00:00:00`))
    : null;
  const result: { start: Date; end: Date }[] = [];
  for (let i = 0; i < MAX_OCCURRENCES; i += 1) {
    // Sempre a partir do primeiro (31 de janeiro + 1 mês não deve "escorregar" para dia 28).
    const start = step(first, i);
    if (start > to || (until && start > until)) break;
    if (overlaps(start)) result.push({ start, end: new Date(start.getTime() + duration) });
  }
  return result;
};
