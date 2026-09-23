import { endOfWeek, format, startOfWeek } from 'date-fns';
import type { DaySummary } from '@/lib/timeclock';

/** Minutos trabalhados na semana corrente (segunda a domingo). */
export const weekMinutes = (days: DaySummary[], now: Date = new Date()): number => {
  const from = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const to = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return days
    .filter(d => d.date >= from && d.date <= to)
    .reduce((sum, d) => sum + d.workedMinutes, 0);
};

/** IBAN/nº de documento com só os últimos 4 caracteres visíveis. */
export const maskTail = (value: string | null | undefined, visible = 4): string | null => {
  if (!value) return null;
  const clean = value.replace(/\s+/g, '');
  if (clean.length <= visible) return clean;
  return `•••• ${clean.slice(-visible)}`;
};
