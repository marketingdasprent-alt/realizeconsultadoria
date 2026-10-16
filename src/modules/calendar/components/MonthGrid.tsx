import React from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface MonthGridProps {
  month: Date;
  renderDay: (day: Date) => React.ReactNode;
  onDayClick?: (day: Date) => void;
  /** Clicar no número do dia (em vez do espaço vazio). */
  onDayNumberClick?: (day: Date) => void;
  /** Dias destacados (ex.: seleção para pedir férias). */
  isSelected?: (day: Date) => boolean;
  dayClassName?: (day: Date) => string | undefined;
}

/** Grelha de um mês (semana a começar à segunda), com o conteúdo de cada dia à escolha. */
export const MonthGrid: React.FC<MonthGridProps> = ({
  month,
  renderDay,
  onDayClick,
  onDayNumberClick,
  isSelected,
  dayClassName,
}) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-rz-line">
      <div className="grid grid-cols-7 border-b border-rz-line bg-rz-canvas/60">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="py-2 text-center text-[11.5px] font-bold uppercase tracking-wider text-rz-muted"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={day.toISOString()}
              role={onDayClick ? 'button' : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onClick={() => onDayClick?.(day)}
              onKeyDown={event => event.key === 'Enter' && onDayClick?.(day)}
              className={cn(
                'min-h-[64px] border-b border-r border-rz-line p-1.5 text-left align-top transition-colors sm:min-h-[92px] md:min-h-[112px]',
                !inMonth && 'bg-rz-canvas/40 text-rz-muted',
                onDayClick && 'cursor-pointer hover:bg-rz-primary-soft/50',
                isSelected?.(day) && 'bg-rz-primary-soft',
                dayClassName?.(day)
              )}
            >
              {onDayNumberClick ? (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onDayNumberClick(day);
                  }}
                  title="Ver o dia"
                  className={cn(
                    'mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold hover:bg-rz-primary-soft hover:text-rz-primary',
                    isToday(day) && 'bg-rz-primary text-white hover:bg-rz-primary hover:text-white'
                  )}
                >
                  {format(day, 'd')}
                </button>
              ) : (
                <span
                  className={cn(
                    'mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold',
                    isToday(day) && 'bg-rz-primary text-white'
                  )}
                >
                  {format(day, 'd')}
                </span>
              )}
              <div className="space-y-0.5">{renderDay(day)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
