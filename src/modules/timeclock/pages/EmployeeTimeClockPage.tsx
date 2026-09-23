import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinutes } from '@/lib/timeclock';
import { useCurrentEmployee } from '../hooks/useCurrentEmployee';
import { useMyTimeClock } from '../hooks/useMyTimeClock';
import { EmployeeTimeClockHeader } from '../components/employee/EmployeeTimeClockHeader';
import { PunchPanel } from '../components/employee/PunchPanel';
import { TimeClockDayList } from '../components/employee/TimeClockDayList';

const EmployeeTimeClockPage: React.FC = () => {
  const { employee, isLoading: isLoadingEmployee } = useCurrentEmployee();
  const { days, today, lastEntry, nextType, isLoading, error, refetch } = useMyTimeClock(
    employee?.id ?? null
  );

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthDays = useMemo(
    () => days.filter(d => d.date.startsWith(currentMonthKey)),
    [days, currentMonthKey]
  );
  const monthMinutes = monthDays.reduce((sum, d) => sum + d.workedMinutes, 0);

  if (isLoadingEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center text-muted-foreground">
        A sua conta não está associada a um colaborador.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <EmployeeTimeClockHeader subtitle={employee.companies?.name ?? undefined} />
      <main className="container mx-auto px-4 py-4 lg:py-6 max-w-3xl space-y-6">
        <PunchPanel lastEntry={lastEntry} nextType={nextType} onPunched={refetch} />

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeClockDayList days={today ? [today] : []} emptyMessage="Sem registos hoje." />
          </CardContent>
        </Card>

        <Card className="shadow-card">
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
      </main>
    </div>
  );
};

export default EmployeeTimeClockPage;
