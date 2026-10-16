import React from 'react';
import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  CalendarDays,
  CalendarX2,
  Clock,
  Flag,
  Info,
  MapPin,
  StickyNote,
  Users,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatDays } from '@/modules/absences/lib/absenceRules';
import type { CalendarInfo, CalendarItem } from '../types';

interface InfoDetailSheetProps {
  item: CalendarItem | null;
  onClose: () => void;
  /** Abre "Férias e ausências" (só nas minhas). */
  onOpenAbsences: () => void;
}

const Line: React.FC<{ icon: React.ElementType; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <p className="flex items-start gap-3 text-[14px]">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rz-muted" />
    <span className="min-w-0">{children}</span>
  </p>
);

const day = (date: Date) => format(date, "EEEE, d 'de' MMMM", { locale: pt });

const range = (start: Date, end: Date) =>
  isSameDay(start, end)
    ? day(start)
    : `${format(start, "d 'de' MMM", { locale: pt })} – ${format(end, "d 'de' MMM yyyy", { locale: pt })}`;

/** Quando falta: "hoje", "amanhã", "daqui a 12 dias", "há 3 dias" ou "a decorrer". */
const countdown = (start: Date, end: Date, now = new Date()): string => {
  const today = startOfDay(now);
  if (start <= now && end >= today) return 'A decorrer agora';
  const days = differenceInCalendarDays(start, today);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days > 1) return `Daqui a ${days} dias`;
  return days === -1 ? 'Ontem' : `Há ${-days} dias`;
};

const Holiday: React.FC<{
  item: CalendarItem;
  info: Extract<CalendarInfo, { kind: 'holiday' }>;
}> = ({ item, info }) => {
  const weekend = [0, 6].includes(item.start.getDay());
  return (
    <div className="space-y-2.5">
      <Line icon={CalendarDays}>
        <span className="first-letter:uppercase">{day(item.start)}</span>
        <span className="block text-[13px] text-rz-muted">{countdown(item.start, item.end)}</span>
      </Line>
      <Line icon={info.national ? Flag : MapPin}>
        {info.national ? 'Feriado nacional' : 'Feriado municipal'}
      </Line>
      <Line icon={Info}>
        {weekend
          ? 'Cai a um fim de semana, por isso não muda os seus dias úteis.'
          : 'Dia não útil: não conta como dia de férias nem de trabalho. Se pedir férias à volta deste dia, ele não é descontado.'}
      </Line>
    </div>
  );
};

const Absence: React.FC<{
  item: CalendarItem;
  info: Extract<CalendarInfo, { kind: 'absence' }>;
}> = ({ item, info }) => (
  <div className="space-y-4">
    <div className="space-y-2.5">
      <Line icon={CalendarDays}>
        <span className="first-letter:uppercase">{range(item.start, item.end)}</span>
        <span className="block text-[13px] text-rz-muted">{countdown(item.start, item.end)}</span>
      </Line>
      <Line icon={Clock}>
        {info.hours ?? `${formatDays(info.days)} ${info.days === 1 ? 'dia útil' : 'dias úteis'}`}
      </Line>
      {info.notes && <Line icon={StickyNote}>{info.notes}</Line>}
    </div>
    {info.siblings.length > 0 && (
      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-rz-muted">
          Outros períodos do mesmo pedido
        </p>
        <ul className="space-y-1.5">
          {info.siblings.map(period => (
            <li
              key={period.key}
              className="flex items-center justify-between gap-2 rounded-xl bg-rz-canvas px-3 py-2 text-[13px]"
            >
              <span>{range(period.start, period.end)}</span>
              <span className="text-rz-muted">{period.pending ? 'Pendente' : 'Aprovado'}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

/** Detalhe, na lateral, de férias/ausências, feriados e ausências de colegas. */
export const InfoDetailSheet: React.FC<InfoDetailSheetProps> = ({
  item,
  onClose,
  onOpenAbsences,
}) => {
  const info = item?.info;
  return (
    <Sheet open={!!info} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="rz-scroll w-full overflow-y-auto border-0 p-0 sm:max-w-md"
      >
        {item && info && (
          <div className="space-y-5 p-6">
            <div className="pr-6">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold',
                  item.tone
                )}
              >
                {info.kind === 'holiday' && 'Feriado'}
                {info.kind === 'absence' && (info.pending ? 'À espera dos RH' : 'Aprovado')}
                {info.kind === 'team' && (
                  <>
                    <Users className="h-3.5 w-3.5" /> Colega do departamento
                  </>
                )}
              </span>
              <SheetTitle className="mt-3 text-[22px] font-extrabold leading-tight">
                {info.kind === 'absence'
                  ? info.typeLabel
                  : info.kind === 'team'
                    ? `${info.name} está ausente`
                    : info.name}
              </SheetTitle>
              {info.kind === 'absence' && (
                <p className="mt-1 text-[14px] text-rz-muted">
                  Tem {info.typeLabel.toLowerCase()} neste dia.
                </p>
              )}
            </div>
            {info.kind === 'holiday' && <Holiday item={item} info={info} />}
            {info.kind === 'absence' && <Absence item={item} info={info} />}
            {info.kind === 'team' && (
              <div className="space-y-2.5">
                <Line icon={CalendarX2}>
                  <span className="first-letter:uppercase">{range(item.start, item.end)}</span>
                </Line>
                <Line icon={Info}>
                  Só se mostram os dias já aprovados, sem o motivo, para respeitar a privacidade.
                </Line>
              </div>
            )}
            {info.kind === 'absence' && (
              <button
                type="button"
                onClick={onOpenAbsences}
                className="h-11 w-full rounded-full bg-rz-primary text-sm font-bold text-white"
              >
                Abrir em Férias e ausências
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
