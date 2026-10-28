import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { MoreHorizontal, Paperclip, Trash2, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { formatTimeRange } from '@/lib/vacation-utils';
import { cn } from '@/lib/utils';
import { formatPeriodDays } from '../lib/absenceRules';
import type { PeriodItem, PeriodStatus } from '../lib/periodItems';

const STATUS: Record<PeriodStatus, { label: string; chip: string; dot: string }> = {
  approved: { label: 'Aprovado', chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  pending: { label: 'À espera dos RH', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
  rejected: { label: 'Rejeitado', chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

const short = (iso: string, pattern: string) =>
  format(new Date(`${iso}T00:00:00`), pattern, { locale: pt });

/** "9 – 13 nov", "30 nov – 7 dez" ou "4 out". */
export const periodDates = (item: Pick<PeriodItem, 'start' | 'end'>) => {
  if (item.start === item.end) return short(item.start, 'd MMM');
  const sameMonth = item.start.slice(0, 7) === item.end.slice(0, 7);
  return sameMonth
    ? `${short(item.start, 'd')} – ${short(item.end, 'd MMM')}`
    : `${short(item.start, 'd MMM')} – ${short(item.end, 'd MMM')}`;
};

export interface PeriodRowActions {
  onEdit: (item: PeriodItem) => void;
  onCancel: (item: PeriodItem) => void;
  onAttach: (item: PeriodItem) => void;
  onViewDocuments: (item: PeriodItem) => void;
  onPickNewDates: (item: PeriodItem) => void;
}

interface PeriodRowProps extends PeriodRowActions {
  item: PeriodItem;
  highlighted: boolean;
  onHover: (id: string | null) => void;
}

/** Uma linha por período: datas, tipo e dias, estado e a ação que faz sentido. */
export const PeriodRow: React.FC<PeriodRowProps> = ({ item, highlighted, onHover, ...actions }) => {
  const status = STATUS[item.status];
  const muted = item.group === 'history';
  const type = absenceTypeLabels[item.absenceType] ?? item.absenceType;
  const detail = [
    type +
      (item.trainingMode ? ` (${trainingModeLabels[item.trainingMode] ?? item.trainingMode})` : ''),
    item.periodType === 'partial' && item.startTime && item.endTime
      ? formatTimeRange(item.startTime, item.endTime)
      : null,
    item.businessDays > 0 ? formatPeriodDays(item.businessDays) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const requested =
    item.siblings > 1 && item.requestedAt
      ? `pedido de ${short(item.requestedAt.slice(0, 10), 'd MMM')}`
      : null;

  return (
    <li
      id={`periodo-${item.id}`}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'rounded-2xl px-3 py-3 transition-colors md:px-4',
        highlighted
          ? 'bg-rz-primary-soft'
          : item.group === 'attention'
            ? 'bg-rose-50'
            : 'hover:bg-rz-canvas',
        muted && 'text-rz-muted'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', muted ? 'bg-slate-300' : status.dot)}
        />
        <span className="w-[112px] shrink-0 text-[14.5px] font-bold">{periodDates(item)}</span>
        <span className="min-w-0 flex-1 basis-40 text-[13.5px] text-rz-muted">
          {detail}
          {requested && <span className="text-[12px]"> · {requested}</span>}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
            muted ? 'bg-rz-canvas text-rz-muted' : status.chip
          )}
        >
          {muted && item.status === 'approved'
            ? 'Já passou'
            : item.inProgress
              ? 'A decorrer'
              : status.label}
        </span>
        <div className="flex items-center gap-1">
          {item.group === 'attention' && (
            <button
              type="button"
              onClick={() => actions.onPickNewDates(item)}
              className="h-9 rounded-full bg-rz-primary px-4 text-[13px] font-semibold text-white"
            >
              Marcar outras datas
            </button>
          )}
          {item.canEdit && (
            <button
              type="button"
              onClick={() => actions.onEdit(item)}
              className="h-9 rounded-full bg-rz-primary-soft px-4 text-[13px] font-semibold text-rz-primary transition-colors hover:bg-rz-primary hover:text-white"
              aria-label={`${item.status === 'approved' ? 'Remarcar' : 'Editar'} ${periodDates(item)}`}
            >
              {item.status === 'approved' ? 'Remarcar' : 'Editar'}
            </button>
          )}
          {/* Também nos períodos já passados: a justificação (ex.: atestado) chega depois. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-white"
                aria-label="Mais ações"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => actions.onAttach(item)}>
                <Upload className="mr-2 h-4 w-4" /> Anexar documento
              </DropdownMenuItem>
              {item.documentCount > 0 && (
                <DropdownMenuItem onClick={() => actions.onViewDocuments(item)}>
                  <Paperclip className="mr-2 h-4 w-4" /> Ver anexos ({item.documentCount})
                </DropdownMenuItem>
              )}
              {item.canCancel && (
                <DropdownMenuItem
                  onClick={() => actions.onCancel(item)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />{' '}
                  {item.status === 'rejected' ? 'Remover' : 'Cancelar período'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {item.rejectionReason && (
        <p className="mt-2 pl-[22px] text-[13px] text-rose-700">
          <span className="font-bold">Motivo:</span> {item.rejectionReason}
        </p>
      )}
      {item.note && !muted && item.group !== 'attention' && (
        <p className="mt-1 pl-[22px] text-[12.5px] italic text-rz-muted">“{item.note}”</p>
      )}
    </li>
  );
};
