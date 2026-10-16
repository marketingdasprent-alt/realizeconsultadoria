import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import DocumentUploader from '@/components/employee/DocumentUploader';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { cn } from '@/lib/utils';
import type { DatePeriod } from '@/lib/vacation-utils';
import type { NewAbsenceInput } from '../hooks/useMyAbsences';
import { formatDays, maxVacationDays } from '../lib/absenceRules';
import { absenceTypeStyle } from '../lib/absenceTypeStyles';
import { docsFirst, totalDays } from '../lib/newRequest';
import type { AbsencesData } from '../services/absenceRequestService';
import { ChosenPeriods } from './ChosenPeriods';
import { RequestCalendar } from './RequestCalendar';

interface NewAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AbsencesData;
  isSubmitting: boolean;
  onSubmit: (input: NewAbsenceInput) => Promise<boolean>;
  /** Férias escolhidas no Calendário: tipo e períodos já preenchidos. */
  preset?: { absenceType: string; periods: DatePeriod[] } | null;
}

const LABEL = 'mb-2 block text-[12.5px] font-bold uppercase tracking-[0.08em] text-rz-muted';

/**
 * Novo pedido num só ecrã: motivo, calendário sempre visível, as datas escolhidas com o
 * total de dias, e o que mais faz sentido para esse motivo (nota nas férias; comprovativo
 * nos restantes). As validações (48 h, conflitos, pendentes, quota) são as de sempre.
 */
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
  const [showDocs, setShowDocs] = useState(false);
  const presetRef = useRef(preset);
  presetRef.current = preset;

  useEffect(() => {
    if (!open) return;
    const type = presetRef.current?.absenceType || 'vacation';
    setAbsenceType(type);
    setTrainingMode('');
    setPeriods(presetRef.current?.periods ?? []);
    setNotes('');
    setFiles([]);
    setShowDocs(false);
  }, [open]);

  const days = totalDays(periods, data.holidays);
  const quota =
    absenceType === 'vacation'
      ? maxVacationDays(data.balance, data.scheduledByEmployee)
      : undefined;
  const overQuota = quota !== undefined && days > quota;
  const ready =
    !!absenceType &&
    periods.length > 0 &&
    (absenceType !== 'training' || !!trainingMode) &&
    periods.every(p => p.periodType !== 'partial' || (p.endTime ?? '') > (p.startTime ?? ''));

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

  const pickType = (key: string) => {
    setAbsenceType(key);
    if (key !== 'training') setTrainingMode('');
    // Mudar para férias pode deixar dias que já não cumprem a antecedência de 48 h.
    if (key === 'vacation') {
      const limit = new Date();
      limit.setHours(0, 0, 0, 0);
      limit.setDate(limit.getDate() + 2);
      setPeriods(list => list.filter(p => p.from >= limit));
    }
  };

  const uploader = (
    <DocumentUploader files={files} onFilesChange={setFiles} disabled={isSubmitting} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        className="flex h-[94dvh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]"
      >
        <div className="px-6 pb-3 pt-6">
          <DialogTitle className="text-2xl font-extrabold">Novo pedido</DialogTitle>
        </div>

        <div className="rz-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-4">
          <div>
            <span className={LABEL}>Motivo</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Object.entries(absenceTypeLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickType(key)}
                  aria-pressed={absenceType === key}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center text-[11.5px] font-semibold leading-tight ring-1 transition-all',
                    absenceType === key
                      ? 'bg-rz-primary-soft ring-2 ring-rz-primary'
                      : 'ring-rz-line hover:bg-rz-canvas'
                  )}
                >
                  <ModuleIcon module={absenceTypeStyle(key)} size="sm" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {absenceType === 'training' && (
              <div className="mt-3 flex rounded-full bg-rz-canvas p-1">
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
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <span className={LABEL}>Quando</span>
              <RequestCalendar
                absenceType={absenceType}
                periods={periods}
                onChange={setPeriods}
                holidays={data.holidays}
                absences={data.absences}
              />
            </div>
            <div className="space-y-4">
              <div>
                <span className={LABEL}>As suas datas</span>
                <ChosenPeriods periods={periods} holidays={data.holidays} onChange={setPeriods} />
              </div>
              {periods.length > 0 && (
                <div className="space-y-1 rounded-2xl bg-rz-primary-soft px-4 py-3 text-[13px]">
                  <p className="flex justify-between">
                    <span>Este pedido</span>
                    <b>
                      {formatDays(days)} {days === 1 ? 'dia' : 'dias'}
                    </b>
                  </p>
                  {quota !== undefined && (
                    <p className="flex justify-between text-rz-muted">
                      <span>Pode marcar por si</span>
                      <span>
                        {formatDays(quota)} → {formatDays(quota - days)}
                      </span>
                    </p>
                  )}
                  {overQuota && (
                    <p className="text-amber-700">
                      Passa o que pode marcar por si. Os RH decidem na mesma.
                    </p>
                  )}
                </div>
              )}
              <label className="block">
                <span className={LABEL}>Nota para os RH (opcional)</span>
                <textarea
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  rows={2}
                  placeholder={
                    absenceType === 'vacation' ? 'Ex.: viagem em família' : 'Informações adicionais'
                  }
                  className="w-full resize-none rounded-2xl bg-rz-canvas px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
                />
              </label>
            </div>
          </div>

          {docsFirst(absenceType) || showDocs ? (
            <div>{uploader}</div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDocs(true)}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-rz-primary"
            >
              <Paperclip className="h-4 w-4" /> Anexar um documento (opcional)
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-rz-line bg-white px-6 py-4">
          <span className="hidden text-[12.5px] text-rz-muted sm:inline">
            Os RH recebem o pedido por email.
          </span>
          <div className="ml-auto flex gap-2">
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
              disabled={isSubmitting || !ready}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rz-primary px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting
                ? 'A enviar…'
                : periods.length
                  ? `Enviar ${formatDays(days)} ${days === 1 ? 'dia' : 'dias'} aos RH`
                  : 'Enviar aos RH'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
