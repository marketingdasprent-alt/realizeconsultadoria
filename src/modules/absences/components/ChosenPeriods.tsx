import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { X } from 'lucide-react';
import { AVAILABLE_HOURS, type DatePeriod, type Holiday } from '@/lib/vacation-utils';
import { cn } from '@/lib/utils';
import { formatDays } from '../lib/absenceRules';
import { periodDays } from '../lib/newRequest';
import { RzSelect } from '@/modules/workspace/components/RzSelect';

interface ChosenPeriodsProps {
  periods: DatePeriod[];
  holidays: Holiday[];
  onChange: (periods: DatePeriod[]) => void;
}

const SELECT =
  'h-9 flex-1 rounded-xl bg-white px-2 text-[13px] outline-none ring-1 ring-rz-line focus:ring-rz-primary/40';

const label = (period: DatePeriod) =>
  period.from.getTime() === period.to.getTime()
    ? format(period.from, 'EEE, d MMM', { locale: pt })
    : `${format(period.from, 'd MMM', { locale: pt })} – ${format(period.to, 'd MMM', { locale: pt })}`;

/** As datas escolhidas (uma linha por período); num só dia pode ser só algumas horas. */
export const ChosenPeriods: React.FC<ChosenPeriodsProps> = ({ periods, holidays, onChange }) => {
  const update = (index: number, patch: Partial<DatePeriod>) =>
    onChange(periods.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  if (periods.length === 0)
    return (
      <p className="rounded-2xl border-2 border-dashed border-rz-line px-4 py-5 text-center text-[13px] text-rz-muted">
        As datas que escolher no calendário aparecem aqui. Pode juntar mais do que um período ao
        mesmo pedido.
      </p>
    );

  return (
    <ul className="space-y-2">
      {periods.map((period, index) => {
        const single = period.from.getTime() === period.to.getTime();
        const partial = period.periodType === 'partial';
        const days = periodDays(period, holidays);
        return (
          <li
            key={`${period.from.toISOString()}-${index}`}
            className="rounded-2xl bg-rz-canvas p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[14px] font-bold first-letter:uppercase">
                {label(period)}
              </span>
              <span className="text-[13px] font-semibold text-rz-muted">
                {formatDays(days)} {days === 1 ? 'dia' : 'dias'}
              </span>
              <button
                type="button"
                onClick={() => onChange(periods.filter((_, i) => i !== index))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-white"
                aria-label={`Tirar ${label(period)}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {single && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-1.5">
                  {[false, true].map(value => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() =>
                        update(
                          index,
                          value
                            ? { periodType: 'partial', startTime: '09:00', endTime: '13:00' }
                            : { periodType: 'full_day', startTime: undefined, endTime: undefined }
                        )
                      }
                      className={cn(
                        'rounded-full px-3 py-1 text-[12px] font-semibold',
                        partial === value ? 'bg-rz-ink text-white' : 'bg-white text-rz-muted'
                      )}
                    >
                      {value ? 'Só algumas horas' : 'Dia completo'}
                    </button>
                  ))}
                </div>
                {partial && (
                  <div className="flex items-center gap-2">
                    <RzSelect
                      value={period.startTime ?? ''}
                      onChange={start => {
                        // A hora de fim tem de ser depois da de início.
                        const end =
                          (period.endTime ?? '') > start
                            ? period.endTime
                            : AVAILABLE_HOURS.find(h => h > start);
                        update(index, { startTime: start, endTime: end });
                      }}
                      className={SELECT}
                      ariaLabel="Das"
                      options={AVAILABLE_HOURS.slice(0, -1).map(hour => ({
                        value: hour,
                        label: hour,
                      }))}
                    />
                    <span className="text-[12px] text-rz-muted">às</span>
                    <RzSelect
                      value={period.endTime ?? ''}
                      onChange={endTime => update(index, { endTime })}
                      className={SELECT}
                      ariaLabel="Às"
                      options={AVAILABLE_HOURS.filter(hour => hour > (period.startTime ?? '')).map(
                        hour => ({ value: hour, label: hour })
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
