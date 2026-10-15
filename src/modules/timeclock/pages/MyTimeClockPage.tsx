import React, { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Clock, Gauge, Loader2 } from 'lucide-react';
import { formatMinutes, summarizeDays } from '@/lib/timeclock';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { TimeClockDayList } from '../components/employee/TimeClockDayList';
import { TodayHero } from '../components/employee/TodayHero';
import { WorkdayPanel } from '../components/employee/WorkdayPanel';
import { useWorkday } from '../context/useWorkday';
import { useMyTimeClock } from '../hooks/useMyTimeClock';

const Stat: React.FC<{ icon: React.ElementType; label: string; value: string; tone?: string }> = ({
  icon: Icon,
  label,
  value,
  tone = 'text-rz-primary',
}) => (
  <div className="rounded-[22px] bg-white p-4 ring-1 ring-rz-line">
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rz-muted">
      <Icon className={`h-4 w-4 ${tone}`} /> {label}
    </p>
    <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
  </div>
);

/** O meu ponto (briefing §8): hoje, ações da jornada e o resumo do mês. */
const MyTimeClockPage: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const { version, entries: todayEntries } = useWorkday();
  const month = useMyTimeClock(isPreview ? null : user.employeeId);

  // Registo novo (aqui ou no relógio da barra superior): atualiza o mês.
  const { refetch } = month;
  useEffect(() => {
    if (version > 0 && !isPreview) refetch();
  }, [version, isPreview, refetch]);

  // Mês na hora local (a versão anterior usava UTC e falhava na primeira hora do mês).
  const monthKey = format(new Date(), 'yyyy-MM');
  const days = useMemo(
    () =>
      (isPreview ? summarizeDays(todayEntries) : month.days).filter(d =>
        d.date.startsWith(monthKey)
      ),
    [isPreview, todayEntries, month.days, monthKey]
  );
  const minutes = days.reduce((sum, d) => sum + d.workedMinutes, 0);
  const worked = days.filter(d => d.workedMinutes > 0).length;
  const incomplete = days.filter(d => d.incomplete).length;

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Ponto</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <TodayHero />
          <section className="rounded-[28px] bg-white p-3 shadow-rz-soft ring-1 ring-rz-line sm:p-4">
            <WorkdayPanel />
          </section>
        </div>

        <section className="min-w-0 space-y-4" aria-label="Este mês">
          <h2 className="text-lg font-bold capitalize">
            {format(new Date(), 'MMMM yyyy', { locale: pt })}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <Stat icon={Clock} label="Horas" value={formatMinutes(minutes)} />
            <Stat
              icon={CalendarDays}
              label="Dias com registo"
              value={String(worked)}
              tone="text-sky-500"
            />
            <Stat
              icon={Gauge}
              label="Média por dia"
              value={worked ? formatMinutes(Math.round(minutes / worked)) : '—'}
              tone="text-emerald-500"
            />
            <Stat
              icon={AlertTriangle}
              label="Incompletos"
              value={String(incomplete)}
              tone={incomplete ? 'text-amber-500' : 'text-rz-muted'}
            />
          </div>
          {month.error && <p className="text-sm text-rose-600">{month.error}</p>}
          {month.isLoading && !isPreview ? (
            <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-rz-primary" />
          ) : (
            <TimeClockDayList days={days} emptyMessage="Ainda sem registos este mês." />
          )}
        </section>
      </div>
    </WorkspacePage>
  );
};

export default MyTimeClockPage;
