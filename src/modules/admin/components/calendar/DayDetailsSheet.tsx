import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PartyPopper } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ROUTES } from '@/lib/constants';
import { isWeekend, type Holiday } from '@/lib/vacation-utils';
import { holidayOn, isoDay, type DayEntry } from '../../lib/teamCalendar';
import { entryPeriod, entryStyle, typeLabel } from './entryStyle';

interface DayDetailsSheetProps {
  day: Date | null;
  entries: DayEntry[];
  holidays: Holiday[];
  showCompany: boolean;
  onClose: () => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

const Person: React.FC<{ entry: DayEntry; showCompany: boolean }> = ({ entry, showCompany }) => (
  <li className="flex items-center gap-3 rounded-2xl p-2">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rz-primary-soft text-[12px] font-bold text-rz-primary">
      {initials(entry.name)}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-semibold">{entry.name}</span>
      <span className="block truncate text-[12.5px] text-rz-muted">
        {entryPeriod(entry)}
        {showCompany && entry.companyName ? ` · ${entry.companyName}` : ''}
      </span>
    </span>
    <span
      style={entryStyle(entry)}
      className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
    >
      {typeLabel(entry.type)}
    </span>
  </li>
);

/** Todos os ausentes de um dia (aprovados e pendentes), num painel lateral. */
export const DayDetailsSheet: React.FC<DayDetailsSheetProps> = ({
  day,
  entries,
  holidays,
  showCompany,
  onClose,
}) => {
  const approved = entries.filter(entry => entry.status === 'approved');
  const pending = entries.filter(entry => entry.status === 'pending');
  const holiday = day ? holidayOn(isoDay(day), holidays) : undefined;

  return (
    <Sheet open={!!day} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto font-jakarta sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[20px] font-extrabold first-letter:uppercase">
            {day ? format(day, "EEEE, d 'de' MMMM", { locale: pt }) : ''}
          </SheetTitle>
        </SheetHeader>

        {holiday && (
          <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-[13.5px] font-semibold text-rose-700">
            Feriado · {holiday.name}
          </p>
        )}
        {day && isWeekend(day) && (
          <p className="mt-3 text-[13.5px] text-rz-muted">Fim de semana.</p>
        )}

        {entries.length === 0 && day && !holiday && !isWeekend(day) && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft">
              <PartyPopper className="h-6 w-6 text-rz-primary" />
            </span>
            <p className="font-semibold">Equipa completa</p>
            <p className="text-[13px] text-rz-muted">Ninguém ausente neste dia.</p>
          </div>
        )}

        {approved.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-1 px-2 text-[12px] font-bold uppercase tracking-wide text-rz-muted">
              Ausentes · {approved.length}
            </h3>
            <ul>
              {approved.map(entry => (
                <Person key={entry.employeeId} entry={entry} showCompany={showCompany} />
              ))}
            </ul>
          </section>
        )}

        {pending.length > 0 && (
          <section className="mt-5">
            <div className="mb-1 flex items-center justify-between px-2">
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-rz-muted">
                Por aprovar · {pending.length}
              </h3>
              <Link
                to={ROUTES.ADMIN.PENDING_REQUESTS}
                className="text-[13px] font-semibold text-rz-primary hover:underline"
              >
                Abrir pedidos
              </Link>
            </div>
            <ul>
              {pending.map(entry => (
                <Person key={entry.employeeId} entry={entry} showCompany={showCompany} />
              ))}
            </ul>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
};
