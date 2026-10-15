import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatTimeRange } from '@/lib/vacation-utils';
import { formatPeriodDays, type AbsenceRow } from '../lib/absenceRules';

const PERIOD_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: 'Aprovado', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-700' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
};

const day = (iso: string, pattern: string) =>
  format(new Date(`${iso}T00:00:00`), pattern, { locale: pt });

/**
 * Períodos de um pedido: datas, horas (parciais) e dias úteis. Num pedido parcialmente
 * aprovado cada período mostra o seu estado; os rejeitados aparecem riscados.
 */
export const AbsencePeriodsList: React.FC<{ absence: AbsenceRow }> = ({ absence }) => {
  const periods = absence.absence_periods ?? [];
  if (periods.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5 rounded-2xl bg-rz-canvas p-3">
      {periods.map(period => {
        const status = PERIOD_STATUS[period.status] ?? PERIOD_STATUS.pending;
        return (
          <li
            key={period.id}
            className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]"
          >
            <span className={cn(period.status === 'rejected' && 'text-rz-muted line-through')}>
              <span className="font-semibold">
                {day(period.start_date, 'd MMM')}
                {period.start_date !== period.end_date && ` – ${day(period.end_date, 'd MMM')}`}
              </span>
              <span className="ml-1.5 text-rz-muted">
                {period.period_type === 'partial' && period.start_time && period.end_time
                  ? formatTimeRange(period.start_time.slice(0, 5), period.end_time.slice(0, 5))
                  : 'Dia completo'}
              </span>
              <span className="ml-1.5 font-semibold text-emerald-700">
                {formatPeriodDays(period.business_days)}
              </span>
            </span>
            {absence.status === 'partially_approved' && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
                  status.className
                )}
              >
                {status.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
