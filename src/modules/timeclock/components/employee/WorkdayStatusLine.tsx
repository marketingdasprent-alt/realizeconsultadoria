import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { formatMinutes, type TimeClockEntry } from '@/lib/timeclock';
import { deriveWorkday, formatTimer } from '@/lib/workday';
import { useNow } from '../../hooks/useNow';
import { WORKDAY_DOT_CLASSES } from './workdayStyles';

interface WorkdayStatusLineProps {
  entries: TimeClockEntry[];
}

const hhmm = (iso: string) => format(new Date(iso), 'HH:mm');
const minutes = (ms: number) => formatMinutes(ms / 60000);

/** "A trabalhar | 03:12:45" — o cronómetro corre a cada segundo, como no Bitrix24. */
export const WorkdayStatusLine: React.FC<WorkdayStatusLineProps> = ({ entries }) => {
  const now = useNow(1000);
  const day = useMemo(() => deriveWorkday(entries, now), [entries, now]);

  let label = 'Dia não iniciado';
  let value: string | null = null;
  if (day.status === 'working') {
    label = 'A trabalhar';
    value = formatTimer(day.workedMs);
  } else if (day.status === 'paused' && day.since) {
    label = 'Em pausa';
    value = formatTimer(now.getTime() - new Date(day.since).getTime());
  } else if (day.endedAt) {
    label = 'Dia terminado';
    value = minutes(day.workedMs);
  }

  const details = [
    day.startedAt ? `Início ${hhmm(day.startedAt)}` : null,
    day.status === 'paused' ? `Trabalhado ${minutes(day.workedMs)}` : null,
    day.breakMs >= 60_000 ? `Pausas ${minutes(day.breakMs)}` : null,
    day.endedAt ? `Fim ${hhmm(day.endedAt)}` : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${WORKDAY_DOT_CLASSES[day.status]}`}
          aria-hidden
        />
        <span>{label}</span>
        {value && (
          <>
            <span className="font-normal text-muted-foreground">|</span>
            <span className="tabular-nums" data-testid="workday-timer">
              {value}
            </span>
          </>
        )}
      </div>
      {details.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{details.join(' · ')}</p>
      )}
    </div>
  );
};
