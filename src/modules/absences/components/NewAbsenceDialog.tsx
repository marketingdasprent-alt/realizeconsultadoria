import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DocumentUploader from '@/components/employee/DocumentUploader';
import MultiPeriodSelector from '@/components/employee/MultiPeriodSelector';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import type { DatePeriod } from '@/lib/vacation-utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import type { NewAbsenceInput } from '../hooks/useMyAbsences';
import { maxVacationDays } from '../lib/absenceRules';
import { absenceTypeStyle } from '../lib/absenceTypeStyles';
import type { AbsencesData } from '../services/absenceRequestService';

interface NewAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AbsencesData;
  isSubmitting: boolean;
  onSubmit: (input: NewAbsenceInput) => Promise<boolean>;
  /** Férias escolhidas no Calendário: tipo e períodos já preenchidos. */
  preset?: { absenceType: string; periods: DatePeriod[] } | null;
}

const LABEL = 'mb-2 block text-[13px] font-bold';

/** Novo pedido: tipo, períodos (dias ou horas), notas e comprovativos. */
export const NewAbsenceDialog: React.FC<NewAbsenceDialogProps> = ({
  open,
  onOpenChange,
  data,
  isSubmitting,
  onSubmit,
  preset,
}) => {
  const [absenceType, setAbsenceType] = useState('');
  const [trainingMode, setTrainingMode] = useState('');
  const [periods, setPeriods] = useState<DatePeriod[]>([]);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<{ file: File; preview?: string }[]>([]);
  const presetRef = useRef(preset);
  presetRef.current = preset;

  useEffect(() => {
    if (!open) return;
    setAbsenceType(presetRef.current?.absenceType ?? '');
    setTrainingMode('');
    setPeriods(presetRef.current?.periods ?? []);
    setNotes('');
    setFiles([]);
  }, [open]);

  const submit = async () => {
    const ok = await onSubmit({
      absenceType,
      trainingMode,
      periods,
      notes,
      files: files.map(f => f.file),
    });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92dvh] w-[96vw] max-w-xl overflow-y-auto rounded-[28px] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-extrabold">Novo pedido</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <span className={LABEL}>Tipo de ausência *</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(absenceTypeLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAbsenceType(key);
                    if (key !== 'training') setTrainingMode('');
                  }}
                  aria-pressed={absenceType === key}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-[12.5px] font-semibold ring-1 transition-all',
                    absenceType === key
                      ? 'bg-rz-primary-soft ring-2 ring-rz-primary'
                      : 'ring-rz-line hover:bg-rz-canvas'
                  )}
                >
                  <ModuleIcon module={absenceTypeStyle(key)} size="sm" />
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {absenceType === 'training' && (
            <div>
              <span className={LABEL}>Modo de formação *</span>
              <div className="flex rounded-full bg-rz-canvas p-1">
                {Object.entries(trainingModeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTrainingMode(key)}
                    className={cn(
                      'flex-1 rounded-full py-2 text-[13px] font-semibold',
                      trainingMode === key ? 'bg-white shadow-sm' : 'text-rz-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <MultiPeriodSelector
            periods={periods}
            onPeriodsChange={setPeriods}
            holidays={data.holidays}
            maxDays={
              absenceType === 'vacation'
                ? maxVacationDays(data.balance, data.scheduledByEmployee)
                : undefined
            }
            existingAbsences={
              data.absences as Parameters<typeof MultiPeriodSelector>[0]['existingAbsences']
            }
            absenceType={absenceType}
          />

          <div>
            <label htmlFor="absence-notes" className={LABEL}>
              Notas
            </label>
            <textarea
              id="absence-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={3}
              placeholder="Informações adicionais (opcional)"
              className="w-full resize-none rounded-2xl bg-rz-canvas px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
            />
          </div>

          <DocumentUploader files={files} onFilesChange={setFiles} disabled={isSubmitting} />
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-11 rounded-full px-5 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rz-primary px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'A submeter…' : 'Submeter pedido'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
