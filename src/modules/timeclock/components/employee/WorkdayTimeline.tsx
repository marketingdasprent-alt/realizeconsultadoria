import React from 'react';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { getEntryAction, getEntryLabel, getEntryPlace, isManualTime } from '@/lib/workday';
import { ACTION_BUBBLE_CLASSES, ACTION_ICONS } from './workdayStyles';

interface WorkdayTimelineProps {
  entries: TimeClockEntryWithRelations[];
}

/** Registos do dia com o sítio de cada um: 08:44 Início · Rua Das Oliveiras… */
export const WorkdayTimeline: React.FC<WorkdayTimelineProps> = ({ entries }) => {
  if (entries.length === 0) return null;
  // Morada do OpenStreetMap: a política do Nominatim pede a atribuição.
  const showsAddress = entries.some(e => !e.location?.name && !!e.address && !isManualTime(e));

  return (
    <section className="rounded-2xl p-2 ring-1 ring-border/70" aria-label="Registos de hoje">
      <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Hoje
      </p>
      <ol>
        {entries.map(entry => {
          const action = getEntryAction(entry);
          const Icon = ACTION_ICONS[action];
          const manual = isManualTime(entry);
          const place = manual ? 'Hora corrigida' : getEntryPlace(entry);
          return (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ACTION_BUBBLE_CLASSES[action]}`}
                aria-hidden
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{getEntryLabel(entry)}</p>
                {place && (
                  <p className="truncate text-xs text-muted-foreground" title={place}>
                    {manual && <Pencil className="mr-1 inline h-3 w-3 align-[-2px]" />}
                    {place}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {format(new Date(entry.punched_at), 'HH:mm')}
              </span>
            </li>
          );
        })}
      </ol>
      {showsAddress && (
        <p className="px-2 pt-1 text-[10px] text-muted-foreground/70">Moradas © OpenStreetMap</p>
      )}
    </section>
  );
};
