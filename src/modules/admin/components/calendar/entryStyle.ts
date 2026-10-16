import type { CSSProperties } from 'react';
import { format, parseISO } from 'date-fns';
import { absenceTypeColors, absenceTypeLabels, defaultAbsenceTypeColor } from '@/lib/absence-types';
import type { DayEntry } from '../../lib/teamCalendar';

export const typeLabel = (type: string): string =>
  absenceTypeLabels[type] ?? absenceTypeLabels.other;

/** Cor do tipo: aprovado em cheio; pendente claro e tracejado. */
export const entryStyle = (entry: Pick<DayEntry, 'type' | 'status'>): CSSProperties => {
  const color = absenceTypeColors[entry.type] ?? defaultAbsenceTypeColor;
  return entry.status === 'approved'
    ? { backgroundColor: color.border, color: color.text }
    : {
        backgroundColor: color.fill,
        color: color.text,
        outline: `1.5px dashed ${color.border}`,
        outlineOffset: '-1.5px',
      };
};

const short = (iso: string) => format(parseISO(iso), 'dd/MM');

/** "09:00–13:00", "14/10" ou "12/10 – 16/10". */
export const entryPeriod = (entry: DayEntry): string => {
  if (entry.partial && entry.startTime && entry.endTime)
    return `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`;
  return entry.periodStart === entry.periodEnd
    ? short(entry.periodStart)
    : `${short(entry.periodStart)} – ${short(entry.periodEnd)}`;
};

/** Texto ao passar o rato numa barra ou num nome. */
export const entryTitle = (entry: DayEntry): string =>
  [
    entry.name,
    typeLabel(entry.type),
    entryPeriod(entry),
    entry.status === 'pending' ? 'Pendente' : 'Aprovado',
  ].join(' · ');
