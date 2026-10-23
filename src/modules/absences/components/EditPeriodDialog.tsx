import React, { useMemo, useState } from 'react';
import { isWeekend } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  AVAILABLE_HOURS,
  calculateBusinessDaysFromHours,
  calculateHoursBetween,
  countBusinessDays,
  isHoliday,
  type Holiday,
} from '@/lib/vacation-utils';
import { cn } from '@/lib/utils';
import type { PeriodEdit } from '../hooks/useMyAbsences';
import { formatDays, maxVacationDays, type VacationBalance } from '../lib/absenceRules';
import type { PeriodItem } from '../lib/periodItems';
import { periodDates } from './PeriodRow';
import { RzSelect } from '@/modules/workspace/components/RzSelect';

interface EditPeriodDialogProps {
  item: PeriodItem;
  holidays: Holiday[];
  balance: VacationBalance | null;
  scheduledByEmployee: number;
  onClose: () => void;
  onSave: (item: PeriodItem, edit: PeriodEdit) => Promise<boolean>;
}

const SELECT =
  'h-10 rounded-xl bg-rz-canvas px-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';
const toDate = (iso: string) => new Date(`${iso}T00:00:00`);
const MIN_NOTICE_DAYS = 2;

/** Muda as datas de um só período (os outros períodos do pedido não são tocados). */
export const EditPeriodDialog: React.FC<EditPeriodDialogProps> = ({
  item,
  holidays,
  balance,
  scheduledByEmployee,
  onClose,
  onSave,
}) => {
  const [range, setRange] = useState<DateRange | undefined>({
    from: toDate(item.start),
    to: toDate(item.end),
  });
  const [partial, setPartial] = useState(item.periodType === 'partial');
  const [startTime, setStartTime] = useState(item.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(item.endTime ?? '13:00');
  const [busy, setBusy] = useState(false);

  const minimum = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + MIN_NOTICE_DAYS);
    return date;
  }, []);

  const from = range?.from;
  const to = range?.to ?? range?.from;
  const singleDay = !!from && !!to && from.getTime() === to.getTime();
  const isPartial = partial && singleDay;
  const days =
    from && to
      ? isPartial
        ? calculateBusinessDaysFromHours(calculateHoursBetween(startTime, endTime))
        : countBusinessDays(from, to, holidays)
      : 0;
  const sameAsBefore =
    !!from &&
    !!to &&
    from.getTime() === toDate(item.start).getTime() &&
    to.getTime() === toDate(item.end).getTime() &&
    isPartial === (item.periodType === 'partial') &&
    (!isPartial || (startTime === item.startTime && endTime === item.endTime));
  const timesOk = !isPartial || endTime > startTime;
  const valid = !!from && !!to && days > 0 && timesOk && !sameAsBefore;
  const allowed = maxVacationDays(balance, scheduledByEmployee);
  const overQuota = allowed !== undefined && days > allowed + item.businessDays;

  const submit = async () => {
    if (!from || !to || !valid) return;
    setBusy(true);
    const ok = await onSave(item, {
      from,
      to,
      periodType: isPartial ? 'partial' : 'full_day',
      startTime: isPartial ? startTime : null,
      endTime: isPartial ? endTime : null,
      businessDays: days,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        className="max-h-[94vh] overflow-y-auto rounded-[28px] sm:max-w-md sm:rounded-[28px]"
      >
        <DialogTitle className="text-xl font-extrabold">
          {item.status === 'approved' ? 'Remarcar este período' : 'Editar este período'}
        </DialogTitle>
        <DialogDescription className="text-[13.5px]">
          {periodDates(item)} · {formatDays(item.businessDays)}{' '}
          {item.businessDays === 1 ? 'dia' : 'dias'}.
          {item.siblings > 1 && ' Os outros períodos do pedido não são alterados.'}
        </DialogDescription>

        <div className="flex justify-center rounded-2xl bg-rz-canvas p-2">
          <Calendar
            mode="range"
            locale={pt}
            weekStartsOn={1}
            defaultMonth={toDate(item.start) > minimum ? toDate(item.start) : minimum}
            selected={range}
            onSelect={setRange}
            disabled={date => date < minimum || isWeekend(date) || !!isHoliday(date, holidays)}
          />
        </div>

        {singleDay && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[false, true].map(value => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setPartial(value)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-[13px] font-semibold',
                    partial === value ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
                  )}
                >
                  {value ? 'Só algumas horas' : 'Dia completo'}
                </button>
              ))}
            </div>
            {partial && (
              <div className="flex items-center gap-2">
                <RzSelect
                  value={startTime}
                  onChange={setStartTime}
                  className={cn(SELECT, 'flex-1')}
                  ariaLabel="Das"
                  options={AVAILABLE_HOURS.slice(0, -1).map(hour => ({ value: hour, label: hour }))}
                />
                <span className="text-sm text-rz-muted">às</span>
                <RzSelect
                  value={endTime}
                  onChange={setEndTime}
                  className={cn(SELECT, 'flex-1')}
                  ariaLabel="Às"
                  options={AVAILABLE_HOURS.filter(hour => hour > startTime).map(hour => ({
                    value: hour,
                    label: hour,
                  }))}
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1 rounded-2xl bg-rz-canvas px-4 py-3 text-[13px]">
          <p>
            {from && to ? (
              <>
                <b>{formatDays(days)}</b> {days === 1 ? 'dia útil' : 'dias úteis'} (fins de semana e
                feriados não contam)
              </>
            ) : (
              'Escolha o primeiro e o último dia.'
            )}
          </p>
          {overQuota && (
            <p className="text-amber-700">
              Passa o que pode marcar por si. Os RH decidem na mesma.
            </p>
          )}
          <p className="text-rz-muted">
            {item.status === 'approved'
              ? 'Depois de guardar, estas datas ficam à espera dos RH; o resto continua aprovado.'
              : 'Continua à espera dos RH, com as novas datas.'}
          </p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar novas datas
        </button>
      </DialogContent>
    </Dialog>
  );
};
