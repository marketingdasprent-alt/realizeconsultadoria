import React, { useMemo, useState } from 'react';
import { pt } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DatePeriod, Holiday } from '@/lib/vacation-utils';
import {
  addDaysToPeriods,
  busyDays,
  chosenDays,
  freeDaysBetween,
  isUnavailable,
  noticeFor,
  removeDay,
} from '../lib/newRequest';
import type { AbsenceRow } from '../lib/absenceRules';

interface RequestCalendarProps {
  absenceType: string;
  periods: DatePeriod[];
  onChange: (periods: DatePeriod[]) => void;
  holidays: Holiday[];
  absences: AbsenceRow[];
}

/**
 * Calendário sempre visível: primeiro e último dia entram como um período. O que não se
 * pode pedir (fim de semana, feriado, menos de 48 h nas férias, dias já ocupados) vem
 * cinzento; o que já está marcado aparece pintado.
 */
export const RequestCalendar: React.FC<RequestCalendarProps> = ({
  absenceType,
  periods,
  onChange,
  holidays,
  absences,
}) => {
  const [anchor, setAnchor] = useState<Date | undefined>();
  const [rangeMode, setRangeMode] = useState(false);
  const notice = noticeFor(absenceType);
  const busy = useMemo(() => busyDays(absences), [absences]);
  const chosen = useMemo(() => chosenDays(periods), [periods]);

  /** Cada toque liga ou desliga o dia; os seguidos formam um só período. */
  const toggle = (day: Date) => {
    if (chosen.some(c => c.getTime() === day.getTime())) {
      onChange(removeDay(periods, day, holidays, busy));
    } else {
      onChange(addDaysToPeriods(periods, [day], holidays, busy));
    }
    setAnchor(day);
  };

  /** Do último dia tocado até este: todos os dias livres de uma vez. */
  const fill = (to: Date) => {
    if (!anchor) return toggle(to);
    onChange(
      addDaysToPeriods(
        periods,
        freeDaysBetween(anchor, to, holidays, notice, busy, periods),
        holidays,
        busy
      )
    );
    setAnchor(to);
    setRangeMode(false);
  };

  const clickDay = (day: Date, _modifiers: unknown, event: React.MouseEvent) => {
    if (rangeMode || event.shiftKey) fill(day);
    else toggle(day);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-center rounded-2xl bg-rz-canvas p-2">
        <Calendar
          mode="range"
          locale={pt}
          weekStartsOn={1}
          selected={rangeMode && anchor ? { from: anchor, to: anchor } : undefined}
          onDayClick={clickDay}
          disabled={date => isUnavailable(date, holidays, notice, busy)}
          modifiers={{ approved: busy.approved, pending: busy.pending, chosen }}
          modifiersClassNames={{
            approved: '!bg-emerald-100 !text-emerald-800',
            pending: '!bg-amber-100 !text-amber-800',
            chosen: '!bg-rz-primary !text-white !opacity-100',
          }}
        />
      </div>
      <div className="flex min-h-9 items-center justify-center gap-2 text-center text-[12.5px] text-rz-muted">
        <span>
          {rangeMode
            ? anchor
              ? 'Toque no último dia do intervalo.'
              : 'Toque no primeiro dia do intervalo.'
            : 'Toque nos dias que quer. Toque outra vez para tirar.'}
        </span>
        <button
          type="button"
          onClick={() => setRangeMode(mode => !mode)}
          aria-pressed={rangeMode}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold',
            rangeMode ? 'bg-rz-ink text-white' : 'bg-white text-rz-primary ring-1 ring-rz-line'
          )}
        >
          Vários seguidos
        </button>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-rz-muted">
        <li>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-emerald-300" />
          já aprovado
        </li>
        <li>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-amber-300" />à espera dos
          RH
        </li>
        <li>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-rz-primary" />
          nesta marcação
        </li>
      </ul>
    </div>
  );
};
