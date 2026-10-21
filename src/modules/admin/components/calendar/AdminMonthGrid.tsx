import React from 'react';
import { format, getDay, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { isWeekend, type Holiday } from '@/lib/vacation-utils';
import { holidayOn, isoDay, type DayEntry } from '../../lib/teamCalendar';
import { entryStyle, entryTitle } from './entryStyle';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const VISIBLE = 3;

interface AdminMonthGridProps {
  days: Date[];
  entriesByDay: DayEntry[][];
  holidays: Holiday[];
  onDayClick: (day: Date) => void;
}

/** Vista do mês (segunda a domingo): até 3 nomes por dia; o clique abre o dia completo. */
export const AdminMonthGrid: React.FC<AdminMonthGridProps> = ({
  days,
  entriesByDay,
  holidays,
  onDayClick,
}) => {
  const today = new Date();
  // Segunda = 0 … domingo = 6
  const lead = (getDay(days[0]) + 6) % 7;

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'py-1 text-center text-[12px] font-semibold',
              index >= 5 ? 'text-rz-muted/60' : 'text-rz-muted'
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }).map((_, index) => (
          <div key={`lead-${index}`} />
        ))}
        {days.map((day, index) => {
          const entries = entriesByDay[index];
          const holiday = holidayOn(isoDay(day), holidays);
          const isToday = isSameDay(day, today);
          const off = isWeekend(day) || !!holiday;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                'flex min-h-[104px] flex-col rounded-2xl p-1.5 text-left ring-1 transition-colors hover:ring-rz-primary/40',
                isToday
                  ? 'bg-rz-primary-soft ring-rz-primary/40'
                  : off
                    ? 'bg-rz-canvas ring-transparent'
                    : 'bg-white ring-rz-line'
              )}
            >
              <span className="mb-1 flex items-center gap-1.5 px-0.5">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-bold',
                    isToday && 'bg-rz-primary text-white',
                    off && !isToday && 'text-rz-muted/70',
                    holiday && !isToday && 'text-rose-600'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span className="truncate text-[10.5px] font-semibold text-rose-600">
                    {holiday.name}
                  </span>
                )}
              </span>
              <span className="w-full space-y-0.5">
                {entries.slice(0, VISIBLE).map(entry => (
                  <span
                    key={entry.employeeId}
                    title={entryTitle(entry)}
                    style={entryStyle(entry)}
                    className="block truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
                  >
                    {entry.name.split(' ')[0]}
                  </span>
                ))}
                {entries.length > VISIBLE && (
                  <span className="block px-1 text-[11.5px] font-semibold text-rz-primary">
                    +{entries.length - VISIBLE} mais
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
