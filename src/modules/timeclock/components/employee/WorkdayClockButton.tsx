import React, { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOptionalWorkday } from '../../context/useWorkday';
import { useNow } from '../../hooks/useNow';
import { WorkdayPanel } from './WorkdayPanel';
import { WORKDAY_DOT_CLASSES, getWorkdayStatusText } from './workdayStyles';

/**
 * Relógio no canto superior (como no Bitrix24): hora + estado da jornada; ao
 * carregar abre o painel para iniciar, pausar, retomar ou terminar o dia.
 */
export const WorkdayClockButton: React.FC = () => {
  const context = useOptionalWorkday();
  const now = useNow(15_000);
  const [isOpen, setIsOpen] = useState(false);

  if (!context?.employee) return null;
  const statusText = getWorkdayStatusText(context.workday);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-2.5"
          aria-label={`Ponto: ${statusText}`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${WORKDAY_DOT_CLASSES[context.workday.status]}`}
            aria-hidden
          />
          <span className="font-semibold tabular-nums">{format(now, 'HH:mm')}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{statusText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[min(22rem,calc(100vw-1.5rem))]"
      >
        <WorkdayPanel showPageLink onNavigate={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
