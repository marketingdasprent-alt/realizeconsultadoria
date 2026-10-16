import React from 'react';
import { Link } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import type { AbsentToday } from '../services/dashboardService';

interface AbsentTodayCardProps {
  absent: AbsentToday[] | undefined;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

const shortDate = (iso: string) => {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
};

/** Quem está fora hoje (férias, baixa, formação…) e até quando. */
export const AbsentTodayCard: React.FC<AbsentTodayCardProps> = ({ absent }) => (
  <section className="flex flex-col rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line sm:p-6">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[17px] font-extrabold">Ausentes hoje</h2>
      <Link
        to={ROUTES.ADMIN.CALENDAR}
        className="text-[13px] font-semibold text-rz-primary hover:underline"
      >
        Ver calendário
      </Link>
    </div>

    {!absent ? (
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map(key => (
          <div key={key} className="h-12 animate-pulse rounded-2xl bg-rz-canvas" />
        ))}
      </div>
    ) : absent.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft">
          <PartyPopper className="h-6 w-6 text-rz-primary" />
        </span>
        <p className="font-semibold">Equipa completa</p>
        <p className="text-[13px] text-rz-muted">Ninguém está ausente hoje.</p>
      </div>
    ) : (
      <ul className="rz-scroll mt-3 max-h-[280px] space-y-1 overflow-y-auto">
        {absent.map(person => (
          <li key={person.employeeId} className="flex items-center gap-3 rounded-2xl p-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rz-primary-soft text-[12px] font-bold text-rz-primary">
              {initials(person.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{person.name}</span>
              <span className="block text-[12.5px] text-rz-muted">{person.typeLabel}</span>
            </span>
            <span className="shrink-0 rounded-full bg-rz-canvas px-2.5 py-1 text-[12px] font-semibold text-rz-muted">
              até {shortDate(person.until)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);
