import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { formatMinutes } from '@/lib/timeclock';
import { useMyTimeClock } from '@/modules/timeclock/hooks/useMyTimeClock';
import { PunchPanel } from '@/modules/timeclock/components/employee/PunchPanel';
import { weekMinutes } from '../../lib/home-summaries';

interface TimeSummaryCardProps {
  employeeId: string;
  onIncompleteDays: (count: number) => void;
}

/** "Agora": estado do ponto, horas de hoje e da semana, registo manual. */
export const TimeSummaryCard: React.FC<TimeSummaryCardProps> = ({
  employeeId,
  onIncompleteDays,
}) => {
  const { days, today, lastEntry, nextType, isLoading, refetch } = useMyTimeClock(employeeId);
  const todayKey = today?.date;
  const incomplete = days.filter(d => d.incomplete && d.date !== todayKey).length;

  React.useEffect(() => {
    if (!isLoading) onIncompleteDays(incomplete);
  }, [incomplete, isLoading, onIncompleteDays]);

  return (
    <section aria-label="Ponto" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Hoje</p>
          <p className="font-display text-xl font-semibold">
            {formatMinutes(today?.workedMinutes ?? 0)}
            {today?.openSince && (
              <span className="ml-1 text-xs font-normal text-gold">em curso</span>
            )}
          </p>
        </div>
        <Link
          to={ROUTES.EMPLOYEE.TIMECLOCK}
          className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
        >
          <div>
            <p className="text-xs text-muted-foreground">Esta semana</p>
            <p className="font-display text-xl font-semibold">{formatMinutes(weekMinutes(days))}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
      <PunchPanel lastEntry={lastEntry} nextType={nextType} onPunched={refetch} />
    </section>
  );
};
