import React from 'react';
import { Building2, CalendarPlus, Clock3, Sun, UserRound } from 'lucide-react';
import { formatDays, summarizeBalance } from '../lib/absenceRules';
import type { AbsencesData } from '../services/absenceRequestService';

interface AbsenceBalanceHeroProps {
  data: AbsencesData;
  onNewRequest: () => void;
}

const Stat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/75">
      <Icon className="h-3.5 w-3.5" /> {label}
    </p>
    <p className="mt-0.5 text-xl font-extrabold text-white">{value}</p>
  </div>
);

/** Saldo de férias do ano (briefing §10: o saldo fica neste módulo, não no início). */
export const AbsenceBalanceHero: React.FC<AbsenceBalanceHeroProps> = ({ data, onNewRequest }) => {
  const year = new Date().getFullYear();
  const summary = data.balance
    ? summarizeBalance(data.balance, data.scheduledByEmployee, data.pendingVacationDays)
    : null;

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 p-6 text-white shadow-rz-soft md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
            <Sun className="h-4 w-4" /> Férias {year}
          </p>
          {summary ? (
            <p className="mt-1 text-5xl font-extrabold tracking-tight">
              {formatDays(summary.available)}
              <span className="ml-2 text-lg font-semibold text-white/80">dias disponíveis</span>
            </p>
          ) : (
            <p className="mt-2 max-w-sm text-[15px] text-white/90">
              O saldo de férias ainda não foi configurado para {year}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-emerald-700 shadow-lg transition-transform hover:scale-[1.03]"
        >
          <CalendarPlus className="h-4 w-4" /> Novo pedido
        </button>
      </div>
      {summary && (
        <div className="relative mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat icon={Sun} label="Utilizados" value={formatDays(summary.used)} />
          <Stat icon={Clock3} label="Pendentes" value={formatDays(summary.pending)} />
          {summary.selfSchedulable !== null && (
            <>
              <Stat
                icon={UserRound}
                label={`Pode marcar (de ${formatDays(summary.selfSchedulable)})`}
                value={formatDays(summary.remainingSelf ?? 0)}
              />
              <Stat
                icon={Building2}
                label="Reservados pela empresa"
                value={formatDays(summary.companyReserved)}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
};
