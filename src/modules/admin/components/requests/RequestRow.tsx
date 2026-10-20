import React from 'react';
import { Check, ChevronRight, MessageSquareText, Paperclip, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { absenceTypeLabels } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import {
  dateRange,
  requestDuration,
  requestedAgo,
  requestSpan,
  startUrgency,
  type AbsenceRequest,
} from '../../lib/absenceRequests';
import { PersonAvatar, StatusPill, TypeChip } from './requestStyles';

interface RequestRowProps {
  request: AbsenceRequest;
  avatarUrl: string | null;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-colors disabled:opacity-40';

/** Uma linha por pedido: quem, o quê, quando, quanto; aprovar e rejeitar à direita. */
export const RequestRow: React.FC<RequestRowProps> = ({
  request,
  avatarUrl,
  selected,
  onToggle,
  onOpen,
  onApprove,
  onReject,
}) => {
  const pending = request.status === 'pending';
  const span = requestSpan(request);
  const range = dateRange(span.start, span.end);
  const duration = requestDuration(request);
  const urgency = pending ? startUrgency(span.start, span.end) : null;
  const periods = request.periods.length;

  return (
    <li
      onClick={onOpen}
      className={cn(
        'group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-rz-canvas/70 sm:px-4',
        selected && 'bg-rz-primary-soft/60 hover:bg-rz-primary-soft/80'
      )}
    >
      <span className="flex w-5 shrink-0 justify-center" onClick={event => event.stopPropagation()}>
        {pending && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Selecionar pedido de ${request.employee.name}`}
          />
        )}
      </span>
      <PersonAvatar name={request.employee.name} url={avatarUrl} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-rz-ink">
          {request.employee.name}
        </span>
        <span className="block truncate text-[12.5px] text-rz-muted lg:hidden">
          {absenceTypeLabels[request.absence_type] ?? 'Outro'} · {range} · {duration}
        </span>
        <span className="hidden truncate text-[12.5px] text-rz-muted lg:block">
          {request.company.name} · pedido {requestedAgo(request.created_at)}
        </span>
      </span>

      <TypeChip type={request.absence_type} className="hidden w-[132px] lg:inline-flex" />

      <span className="hidden w-[150px] shrink-0 lg:block">
        <span className="block truncate text-[13.5px] font-semibold text-rz-ink">{range}</span>
        <span className="block truncate text-[12px] text-rz-muted">
          {duration}
          {periods > 1 ? ` · ${periods} períodos` : ''}
        </span>
      </span>

      <span className="hidden w-12 shrink-0 items-center gap-2 text-rz-muted xl:flex">
        {request.document_count > 0 && (
          <span className="flex items-center gap-0.5 text-[12px]" title="Documentos">
            <Paperclip className="h-3.5 w-3.5" />
            {request.document_count}
          </span>
        )}
        {request.notes && (
          <span title={request.notes}>
            <MessageSquareText className="h-3.5 w-3.5" />
          </span>
        )}
      </span>

      <span className="hidden w-[118px] shrink-0 justify-end sm:flex">
        {pending ? (
          urgency && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
                urgency.tone === 'late'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              )}
            >
              {urgency.label}
            </span>
          )
        ) : (
          <StatusPill status={request.status} />
        )}
      </span>

      <span
        className="flex w-[84px] shrink-0 justify-end gap-1.5"
        onClick={event => event.stopPropagation()}
      >
        {pending ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              title="Aprovar tudo"
              aria-label={`Aprovar pedido de ${request.employee.name}`}
              className={cn(ICON_BUTTON, 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50')}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onReject}
              title="Rejeitar"
              aria-label={`Rejeitar pedido de ${request.employee.name}`}
              className={cn(ICON_BUTTON, 'text-rose-600 ring-rose-200 hover:bg-rose-50')}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <ChevronRight className="h-4 w-4 self-center text-rz-muted" />
        )}
      </span>
    </li>
  );
};
