import React from 'react';
import { AlertTriangle, Palmtree, UsersRound } from 'lucide-react';
import { absenceTypeLabels } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import { useRequestContext } from '../../hooks/useRequestContext';
import { dateRange, formatAmount, type AbsenceRequest } from '../../lib/absenceRequests';

/** Saldo de férias e colegas fora ao mesmo tempo, no painel do pedido. */
export const RequestContextInfo: React.FC<{ request: AbsenceRequest }> = ({ request }) => {
  const { people, overlapsLoading, balance, year } = useRequestContext(request);
  const pending = request.status === 'pending';
  const available = balance ? balance.total - balance.used : null;
  const short = pending && available !== null && request.total_business_days > available;

  return (
    <div className="space-y-3">
      {request.absence_type === 'vacation' && balance && available !== null && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-2xl p-3',
            short ? 'bg-rose-50 text-rose-800' : 'bg-rz-canvas'
          )}
        >
          {short ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Palmtree className="mt-0.5 h-4 w-4 shrink-0 text-rz-primary" />
          )}
          <div className="text-[13px]">
            <p className="font-semibold">
              Férias {year}: {formatAmount(available)} de {formatAmount(balance.total)} dias
              disponíveis
            </p>
            <p className={short ? '' : 'text-rz-muted'}>
              {pending
                ? short
                  ? `Este pedido (${formatAmount(request.total_business_days)} dias) passa o saldo.`
                  : `Depois de aprovar fica com ${formatAmount(available - request.total_business_days)}.`
                : `${formatAmount(balance.used)} dias já gozados ou marcados.`}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-rz-canvas p-3">
        <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
          <UsersRound className="h-4 w-4 text-rz-primary" />
          {people.length > 0 ? `${people.length} fora nos mesmos dias` : 'Fora nos mesmos dias'}
          <span className="font-normal text-rz-muted">· {request.company.name}</span>
        </p>
        {overlapsLoading ? (
          <div className="h-4 w-2/3 animate-pulse rounded bg-rz-line/60" />
        ) : people.length === 0 ? (
          <p className="text-[13px] text-rz-muted">Ninguém da empresa.</p>
        ) : (
          <ul className="space-y-1.5 text-[13px]">
            {people.map(person => (
              <li key={person.name}>
                <span className="font-medium">{person.name}</span>
                {person.pending && <span className="text-rz-muted"> · pendente</span>}
                <span className="block text-[12.5px] text-rz-muted">
                  {person.items
                    .map(
                      item =>
                        `${absenceTypeLabels[item.absenceType] ?? 'Outro'} ${dateRange(item.start, item.end)}`
                    )
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
