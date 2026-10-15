import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Pencil } from 'lucide-react';
import { formatMinutes, type TimeClockEntry } from '@/lib/timeclock';
import { cn } from '@/lib/utils';
import { deriveWorkday, formatTimer } from '@/lib/workday';
import { useNow } from '../../hooks/useNow';
import { WORKDAY_DOT_CLASSES } from './workdayStyles';

interface WorkdayStatusLineProps {
  entries: TimeClockEntry[];
  /** Lápis ✎: registar com outra hora (registo esquecido). */
  onEdit?: () => void;
  isEditing?: boolean;
  /** Seta › para a página do ponto (no relógio do cabeçalho). */
  onOpenPage?: () => void;
}

const hhmm = (iso: string) => format(new Date(iso), 'HH:mm');
const minutes = (ms: number) => formatMinutes(ms / 60000);

const iconButton =
  'rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

/** "A trabalhar | 03:12:45 ✎ ›" — o cronómetro corre a cada segundo, como no Bitrix24. */
export const WorkdayStatusLine: React.FC<WorkdayStatusLineProps> = ({
  entries,
  onEdit,
  isEditing = false,
  onOpenPage,
}) => {
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
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${WORKDAY_DOT_CLASSES[day.status]}`}
          aria-hidden
        />
        <span className="text-[15px] font-medium">{label}</span>
        {value && (
          <>
            <span className="text-muted-foreground/50" aria-hidden>
              |
            </span>
            <span className="text-[15px] font-semibold tabular-nums" data-testid="workday-timer">
              {value}
            </span>
          </>
        )}
        {onEdit && (
          <button
            type="button"
            className={cn(iconButton, isEditing && 'bg-background text-foreground shadow-sm')}
            aria-label="Registar com outra hora"
            aria-pressed={isEditing}
            title="Esqueceu-se de registar? Indique a hora"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onOpenPage && (
          <button
            type="button"
            className={cn(iconButton, '-mr-1.5 ml-auto')}
            aria-label="Ver o meu ponto"
            onClick={onOpenPage}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {details.length > 0 && (
        <p className="mt-1 pl-[18px] text-xs text-muted-foreground">{details.join(' · ')}</p>
      )}
    </div>
  );
};
