import React, { useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMinutes } from '@/lib/timeclock';
import { useEmployeeOutlet } from '@/modules/employee/hooks/useEmployeeOutlet';
import { useMyTimeClock } from '../hooks/useMyTimeClock';
import { PunchPanel } from '../components/employee/PunchPanel';
import { TimeClockDayList } from '../components/employee/TimeClockDayList';

const EmployeeTimeClockPage: React.FC = () => {
  const { employee } = useEmployeeOutlet();
  const { days, today, lastEntry, nextType, isLoading, error, refetch } = useMyTimeClock(
    employee.id
  );

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
          <p className="mt-4 text-xs text-muted-foreground">
            Esqueceu-se de registar uma entrada ou saída? Abra um pedido de ajuda aos RH em “Mais →
            Suporte”; a correção fica registada no histórico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeTimeClockPage;
