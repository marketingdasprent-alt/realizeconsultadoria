import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ENTRY_TYPE_LABELS, formatMinutes, type DaySummary } from '@/lib/timeclock';

interface TimeClockDayListProps {
  days: DaySummary[];
  emptyMessage: string;
}

/** Lista de dias com os registos e horas trabalhadas (vista do colaborador). */
export const TimeClockDayList: React.FC<TimeClockDayListProps> = ({ days, emptyMessage }) => {
  if (days.length === 0) {
    return <p className="text-muted-foreground text-center py-6 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {days.map(day => (
        <div key={day.date} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-medium text-sm capitalize">
              {format(new Date(`${day.date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: pt })}
            </span>
            <span className="text-sm font-semibold text-gold">
              {formatMinutes(day.workedMinutes)}
              {day.openSince && ' + em curso'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...day.entries]
              .sort((a, b) => a.punched_at.localeCompare(b.punched_at))
              .map(entry => (
                <Badge
                  key={entry.id}
                  variant={entry.entry_type === 'in' ? 'default' : 'secondary'}
                  className={entry.status === 'voided' ? 'line-through opacity-60' : ''}
                >
                  {ENTRY_TYPE_LABELS[entry.entry_type]}{' '}
                  {format(new Date(entry.punched_at), 'HH:mm')}
                  {entry.status === 'flagged' && ' ⚠'}
                </Badge>
              ))}
          </div>
          {day.incomplete && (
            <p className="text-xs text-amber-600 mt-2">
              Dia com registo incompleto — fale com os RH se se esqueceu de picar.
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
