import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, House } from 'lucide-react';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { getEntryLabel } from '@/lib/workday';

interface WorkdayTimelineProps {
  entries: TimeClockEntryWithRelations[];
}

/** Registos do dia: 09:02 Início · 12:30 Pausa · 13:15 Retoma… */
export const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  return (
    <ol className="space-y-1.5 border-t border-border pt-3 text-sm" aria-label="Registos de hoje">
      {entries.map(entry => (
        <li key={entry.id} className="flex items-center gap-2">
          <span className="w-11 shrink-0 tabular-nums text-muted-foreground">
            {format(new Date(entry.punched_at), 'HH:mm')}
          </span>
          <span className="font-medium">{getEntryLabel(entry)}</span>
          {entry.work_mode === 'remote' && (
            <House className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-label="Fora do local" />
          )}
          {entry.status === 'pending' && (
            <span className="rounded border border-dashed border-sky-400 px-1 text-[10px] text-sky-700 dark:text-sky-300">
              a aprovar
            </span>
          )}
          {entry.status === 'flagged' && (
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0 text-amber-600"
              aria-label="Em revisão"
            />
          )}
          {entry.location?.name && (
            <span className="truncate text-xs text-muted-foreground">{entry.location.name}</span>
          )}
        </li>
      ))}
    </ol>
  );
};
