import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  dateRange,
  periodDuration,
  requestDuration,
  type AbsenceRequest,
} from '../../lib/absenceRequests';

/** Os períodos do pedido; na aprovação parcial, cada um com a decisão. */
export const RequestPeriodsList: React.FC<{ request: AbsenceRequest }> = ({ request }) => {
  const partial = request.status === 'partially_approved';
  const periods =
    request.periods.length > 0
      ? request.periods
      : [
          {
            id: request.id,
            start_date: request.start_date,
            end_date: request.end_date,
            business_days: request.total_business_days,
          },
        ];

  return (
    <div className="rounded-2xl ring-1 ring-rz-line">
      <ul className="divide-y divide-rz-line">
        {periods.map(period => {
          const rejected = partial && period.status === 'rejected';
          const approved = partial && period.status === 'approved';
          return (
            <li key={period.id} className="flex items-center gap-3 px-3 py-2.5">
              {partial && (
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    approved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                  )}
                >
                  {approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
              )}
              <span
                className={cn(
                  'min-w-0 flex-1 text-[14px] font-semibold first-letter:uppercase',
                  rejected && 'text-rz-muted line-through'
                )}
              >
                {dateRange(period.start_date, period.end_date)}
              </span>
              <span className="shrink-0 text-[12.5px] text-rz-muted">{periodDuration(period)}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between rounded-b-2xl bg-rz-canvas px-3 py-2 text-[13px]">
        <span className="text-rz-muted">Total pedido</span>
        <span className="font-bold">{requestDuration(request)}</span>
      </div>
    </div>
  );
};
