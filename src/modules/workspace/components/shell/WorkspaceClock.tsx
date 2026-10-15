import React, { useState } from 'react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useOptionalWorkday } from '@/modules/timeclock/context/useWorkday';
import { useNow } from '@/modules/timeclock/hooks/useNow';
import { WorkdayPanel } from '@/modules/timeclock/components/employee/WorkdayPanel';
import {
  WORKDAY_DOT_CLASSES,
  getWorkdayStatusText,
} from '@/modules/timeclock/components/employee/workdayStyles';

/** Duração em h:mm (tempo trabalhado hoje). */
const formatWorked = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * Relógio do ponto, sempre no canto superior direito (briefing §8): hora, estado e
 * tempo trabalhado; abre o painel da jornada (Iniciar / Pausa / Retomar / Terminar).
 */
export const WorkspaceClock: React.FC = () => {
  const context = useOptionalWorkday();
  const now = useNow(15_000);
  const [isOpen, setIsOpen] = useState(false);

  if (!context?.employee) return null;
  const { workday } = context;
  const statusText = getWorkdayStatusText(workday);
  const showWorked = workday.status !== 'closed' || !!workday.endedAt;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'rz-glass flex h-10 items-center gap-2.5 rounded-full pl-3 pr-4 text-white transition-colors hover:bg-white/20',
            isOpen && 'bg-white/20'
          )}
          aria-label={`Ponto: ${statusText}`}
        >
          <span
            className={cn('h-2.5 w-2.5 rounded-full', WORKDAY_DOT_CLASSES[workday.status])}
            aria-hidden
          />
          <span className="text-[15px] font-bold tabular-nums">{format(now, 'HH:mm')}</span>
          <span className="hidden h-4 w-px bg-white/25 sm:block" aria-hidden />
          <span className="hidden text-[13px] font-medium text-white/80 sm:inline">
            {statusText}
            {showWorked && (
              <span className="ml-1.5 tabular-nums text-white/60">
                {formatWorked(workday.workedMs)}
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(24rem,calc(100vw-1.5rem))] rounded-[28px] border-white/60 p-3 shadow-rz-pop"
      >
        <WorkdayPanel showPageLink onNavigate={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
