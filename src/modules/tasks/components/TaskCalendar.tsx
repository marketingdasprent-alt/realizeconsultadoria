import React, { useState } from 'react';
import { addMonths, format, isSameDay, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MonthGrid } from '@/modules/calendar/components/MonthGrid';
import { isOverdue, TASK_STATUSES } from '../lib/taskRules';
import type { Task } from '../types';

/** Tarefas com prazo, no dia do prazo. */
export const TaskCalendar: React.FC<{ tasks: Task[]; onOpen: (task: Task) => void }> = ({
  tasks,
  onOpen,
}) => {
  const [month, setMonth] = useState(new Date());
  const withDue = tasks.filter(t => t.dueAt);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(m => subMonths(m, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-rz-line"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="min-w-40 text-center text-[16px] font-bold first-letter:uppercase">
          {format(month, 'MMMM yyyy', { locale: pt })}
        </h3>
        <button
          type="button"
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-rz-line"
          aria-label="Mês seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <MonthGrid
        month={month}
        renderDay={day =>
          withDue
            .filter(t => isSameDay(new Date(t.dueAt as string), day))
            .map(t => (
              <button
                key={t.id}
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onOpen(t);
                }}
                className={cn(
                  'flex w-full items-center gap-1 truncate rounded-lg px-1.5 py-0.5 text-left text-[11.5px] font-semibold',
                  t.status === 'done'
                    ? 'bg-emerald-50 text-emerald-700 line-through'
                    : isOverdue(t)
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-violet-50 text-violet-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    TASK_STATUSES.find(s => s.key === t.status)?.dot
                  )}
                />
                <span className="truncate">{t.title}</span>
              </button>
            ))
        }
      />
    </div>
  );
};
