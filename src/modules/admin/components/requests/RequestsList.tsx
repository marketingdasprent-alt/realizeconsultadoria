import React, { useEffect, useState } from 'react';
import { Check, Inbox, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AbsenceRequest } from '../../lib/absenceRequests';
import { RequestRow } from './RequestRow';

const PAGE = 60;

interface RequestsListProps {
  requests: AbsenceRequest[];
  isLoading: boolean;
  emptyText: string;
  selected: Set<string>;
  avatarFor: (userId: string | null) => string | null;
  onSelect: (ids: Set<string>) => void;
  onOpen: (request: AbsenceRequest) => void;
  onApprove: (requests: AbsenceRequest[]) => void;
  onReject: (requests: AbsenceRequest[]) => void;
}

/** A lista em linhas, com seleção para aprovar ou rejeitar vários de uma vez. */
export const RequestsList: React.FC<RequestsListProps> = ({
  requests,
  isLoading,
  emptyText,
  selected,
  avatarFor,
  onSelect,
  onOpen,
  onApprove,
  onReject,
}) => {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [requests.length]);

  const pending = requests.filter(request => request.status === 'pending');
  const chosen = pending.filter(request => selected.has(request.id));
  const allChosen = pending.length > 0 && chosen.length === pending.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };

  if (isLoading)
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3, 4, 5].map(key => (
          <div key={key} className="h-12 animate-pulse rounded-xl bg-rz-canvas" />
        ))}
      </div>
    );

  if (requests.length === 0)
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft">
          <Inbox className="h-6 w-6 text-rz-primary" />
        </span>
        <p className="font-semibold">{emptyText}</p>
      </div>
    );

  return (
    <>
      <div className="flex min-h-[44px] items-center gap-3 border-b border-rz-line bg-rz-canvas/50 px-3 text-[12px] font-semibold uppercase tracking-wide text-rz-muted sm:px-4">
        <span className="flex w-5 justify-center">
          {pending.length > 0 && (
            <Checkbox
              checked={allChosen ? true : chosen.length > 0 ? 'indeterminate' : false}
              onCheckedChange={() =>
                onSelect(allChosen ? new Set() : new Set(pending.map(request => request.id)))
              }
              aria-label="Selecionar todos os pendentes"
            />
          )}
        </span>
        {chosen.length > 0 ? (
          <span className="flex flex-1 flex-wrap items-center gap-2 normal-case tracking-normal">
            <span className="text-[13px] text-rz-ink">{chosen.length} selecionados</span>
            <button
              type="button"
              onClick={() => onApprove(chosen)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[13px] font-bold text-white hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" /> Aprovar
            </button>
            <button
              type="button"
              onClick={() => onReject(chosen)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
            >
              <X className="h-4 w-4" /> Rejeitar
            </button>
            <button
              type="button"
              onClick={() => onSelect(new Set())}
              className="text-[13px] font-semibold text-rz-muted hover:text-rz-ink"
            >
              Limpar
            </button>
          </span>
        ) : (
          <>
            <span className="flex-1 pl-12">Colaborador</span>
            <span className="hidden w-[132px] lg:block">Tipo</span>
            <span className="hidden w-[150px] lg:block">Período</span>
            <span className="hidden w-12 xl:block" />
            <span className="hidden w-[118px] sm:block" />
            <span className="w-[84px]" />
          </>
        )}
      </div>

      <ul className="divide-y divide-rz-line">
        {requests.slice(0, limit).map(request => (
          <RequestRow
            key={request.id}
            request={request}
            avatarUrl={avatarFor(request.employee.user_id)}
            selected={selected.has(request.id)}
            onToggle={() => toggle(request.id)}
            onOpen={() => onOpen(request)}
            onApprove={() => onApprove([request])}
            onReject={() => onReject([request])}
          />
        ))}
      </ul>

      {requests.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(value => value + PAGE)}
          className="w-full border-t border-rz-line py-3 text-[13px] font-semibold text-rz-primary hover:bg-rz-canvas/60"
        >
          Mostrar mais ({requests.length - limit})
        </button>
      )}
    </>
  );
};
