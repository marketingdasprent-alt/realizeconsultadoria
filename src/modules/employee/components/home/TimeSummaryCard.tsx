import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { formatMinutes } from '@/lib/timeclock';
import { useWorkday } from '@/modules/timeclock/context/useWorkday';
import { useMyTimeClock } from '@/modules/timeclock/hooks/useMyTimeClock';
import { WorkdayPanel } from '@/modules/timeclock/components/employee/WorkdayPanel';
import { weekMinutes } from '../../lib/home-summaries';

interface TimeSummaryCardProps {
  employeeId: string;
  onIncompleteDays: (count: number) => void;
}

/** "Agora": o painel da jornada (como no relógio do cabeçalho) e as horas da semana. */
export const TimeSummaryCard: React.FC<TimeSummaryCardProps> = ({
  employeeId,
  onIncompleteDays,
}) => {
  const { days, today, isLoading, refetch } = useMyTimeClock(employeeId);
  const { version } = useWorkday();
  const todayKey = today?.date;
  const incomplete = days.filter(d => d.incomplete && d.date !== todayKey).length;

  // Registo novo no painel ou no relógio do cabeçalho: atualiza a semana.
  useEffect(() => {
    if (version > 0) refetch();
  }, [version, refetch]);

  useEffect(() => {
    if (!isLoading) onIncompleteDays(incomplete);
  }, [incomplete, isLoading, onIncompleteDays]);

  return (
    <section aria-label="Ponto" className="space-y-2">
      <div className="rounded-3xl bg-background p-3 shadow-card">
        <WorkdayPanel />
      </div>
      <Link
        to={ROUTES.EMPLOYEE.TIMECLOCK}
        className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 ring-1 ring-border/70 transition-colors hover:bg-secondary"
      >
        <span className="text-sm text-muted-foreground">Esta semana</span>
        <span className="flex items-center gap-1 font-display text-lg font-semibold">
          {formatMinutes(weekMinutes(days))}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </span>
      </Link>
    </section>
  );
};
