import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Paperclip, Pencil, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import {
  ABSENCE_STATUS_LABELS,
  canCancel,
  canReschedule,
  type AbsenceRow,
} from '../lib/absenceRules';
import { absenceTypeStyle, STATUS_CHIP } from '../lib/absenceTypeStyles';
import { AbsencePeriodsList } from './AbsencePeriodsList';

export interface AbsenceActions {
  onReschedule: (absence: AbsenceRow) => void;
  onCancel: (absence: AbsenceRow) => void;
  onAttach: (absence: AbsenceRow) => void;
  onViewDocuments: (absence: AbsenceRow) => void;
}

const ACTION =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors';

const day = (iso: string, pattern: string) =>
  format(new Date(`${iso}T00:00:00`), pattern, { locale: pt });

/** Um pedido: tipo, datas, estado, nota dos RH, períodos e ações permitidas. */
export const AbsenceRequestItem: React.FC<{ absence: AbsenceRow } & AbsenceActions> = ({
  absence,
  onReschedule,
  onCancel,
  onAttach,
  onViewDocuments,
}) => {
  const style = absenceTypeStyle(absence.absence_type);
  const isPending = absence.status === 'pending';
  return (
    <article className="rz-rise rounded-[26px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line md:p-5">
      <div className="flex items-start gap-3">
        <ModuleIcon module={style} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-bold">
              {absenceTypeLabels[absence.absence_type] ?? absence.absence_type}
              {absence.absence_type === 'training' && absence.training_mode && (
                <span className="ml-1 font-medium text-rz-muted">
                  ({trainingModeLabels[absence.training_mode] ?? absence.training_mode})
                </span>
              )}
            </h3>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
                STATUS_CHIP[absence.status]
              )}
            >
              {ABSENCE_STATUS_LABELS[absence.status] ?? absence.status}
            </span>
          </div>
          <p className="mt-0.5 text-[13.5px] text-rz-muted">
            {day(absence.start_date, "d 'de' MMM")}
            {absence.start_date !== absence.end_date &&
              ` – ${day(absence.end_date, "d 'de' MMM yyyy")}`}
          </p>
        </div>
      </div>

      {absence.rejection_reason && (
        <p
          className={cn(
            'mt-3 rounded-2xl px-3.5 py-2.5 text-[13px]',
            absence.status === 'rejected'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-orange-50 text-orange-800'
          )}
        >
          <span className="font-bold">
            {absence.status === 'rejected' ? 'Motivo da rejeição:' : 'Nota:'}
          </span>{' '}
          {absence.rejection_reason}
        </p>
      )}
      {absence.notes && <p className="mt-2 text-[13px] italic text-rz-muted">“{absence.notes}”</p>}

      <AbsencePeriodsList absence={absence} />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {canReschedule(absence) && (
          <button
            type="button"
            onClick={() => onReschedule(absence)}
            className={`${ACTION} bg-rz-primary-soft text-rz-primary hover:bg-rz-primary hover:text-white`}
            aria-label={`${isPending ? 'Editar pedido de férias de' : 'Remarcar férias de'} ${day(absence.start_date, 'dd/MM/yyyy')}`}
          >
            <Pencil className="h-3.5 w-3.5" /> {isPending ? 'Editar' : 'Remarcar'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onAttach(absence)}
          className={`${ACTION} bg-rz-canvas hover:bg-rz-line`}
        >
          <Upload className="h-3.5 w-3.5" /> Anexar
        </button>
        {Number(absence.document_count ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => onViewDocuments(absence)}
            className={`${ACTION} bg-rz-canvas hover:bg-rz-line`}
          >
            <Paperclip className="h-3.5 w-3.5" /> {absence.document_count} anexo
            {absence.document_count === 1 ? '' : 's'}
          </button>
        )}
        {canCancel(absence) && (
          <button
            type="button"
            onClick={() => onCancel(absence)}
            className={`${ACTION} ml-auto text-rose-600 hover:bg-rose-50`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Cancelar
          </button>
        )}
      </div>
    </article>
  );
};
