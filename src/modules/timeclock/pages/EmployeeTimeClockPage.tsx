import React, { useEffect, useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinutes } from '@/lib/timeclock';
import { useEmployeeOutlet } from '@/modules/employee/hooks/useEmployeeOutlet';
import { useWorkday } from '../context/useWorkday';
import { useMyTimeClock } from '../hooks/useMyTimeClock';
import { TimeClockDayList } from '../components/employee/TimeClockDayList';
import { WorkdayPanel } from '../components/employee/WorkdayPanel';

const EmployeeTimeClockPage: React.FC = () => {
  const { employee } = useEmployeeOutlet();
  const { version } = useWorkday();
  const { days, isLoading, error, refetch } = useMyTimeClock(employee.id);

  // Registo novo no painel (ou no relógio do cabeçalho): atualiza o mês.
  useEffect(() => {
    if (version > 0) refetch();
  }, [version, refetch]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthDays = useMemo(
    () => days.filter(d => d.date.startsWith(currentMonthKey)),
    [days, currentMonthKey]
  );
  const monthMinutes = monthDays.reduce((sum, d) => sum + d.workedMinutes, 0);

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Clock className="h-5 w-5 text-gold" /> O Meu Ponto
      </h1>

      <Card className="rounded-3xl shadow-card">
        <CardContent className="p-3 sm:p-4">
          <WorkdayPanel />
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-lg">Este mês</CardTitle>
          <span className="text-sm font-semibold text-gold">{formatMinutes(monthMinutes)}</span>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : (
            <TimeClockDayList days={monthDays} emptyMessage="Ainda sem registos este mês." />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeTimeClockPage;
