import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes, type DaySummary } from '@/lib/timeclock';
import { getEntryAction, getEntryLabel } from '@/lib/workday';
import { ACTION_BUBBLE_CLASSES } from './workdayStyles';

interface TimeClockDayListProps {
  days: DaySummary[];
  emptyMessage: string;
}

/** Dias do mês com os registos, horas trabalhadas, pausas e dias incompletos. */
export const TimeClockDayList: React.FC<TimeClockDayListProps> = ({ days, emptyMessage }) => {
  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-rz-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {days.map(day => (
        <li
          key={day.date}
          className={cn(
            'rounded-[22px] bg-white p-4 ring-1',
            day.incomplete ? 'ring-amber-200' : 'ring-rz-line'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block text-[14px] font-bold first-letter:uppercase">
              {format(new Date(`${day.date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: pt })}
            </span>
            <span className="text-[14px] font-extrabold tabular-nums text-rz-primary">
              {formatMinutes(day.workedMinutes)}
              {day.openSince && <span className="font-semibold text-emerald-600"> + em curso</span>}
              {day.pausedSince && <span className="font-semibold text-amber-600"> · em pausa</span>}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...day.entries]
              .sort((a, b) => a.punched_at.localeCompare(b.punched_at))
              .map(entry => (
                <span
                  key={entry.id}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[12px] font-semibold',
                    ACTION_BUBBLE_CLASSES[getEntryAction(entry)],
                    entry.status === 'voided' && 'line-through opacity-60'
                  )}
                  title={entry.status === 'voided' ? 'Anulado' : undefined}
                >
                  {getEntryLabel(entry)} {format(new Date(entry.punched_at), 'HH:mm')}
                </span>
              ))}
          </div>
          {day.breakMinutes > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-rz-muted">
              <Coffee className="h-3.5 w-3.5" /> Pausas: {formatMinutes(day.breakMinutes)} (não
              contam como trabalho)
            </p>
          )}
          {day.incomplete && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Dia com registo incompleto — use o ✎ no
              ponto ou fale com os RH.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};
