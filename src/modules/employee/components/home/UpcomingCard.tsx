import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { absenceTypeLabels } from '@/lib/absence-types';
import { ROUTES } from '@/lib/constants';
import { formatShortDate, type HomeData } from '@/lib/employee-home';

interface UpcomingCardProps {
  data: HomeData;
}

const formatDays = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** Saldo de férias, próxima ausência e próximo feriado, em três linhas. */
export const UpcomingCard: React.FC<UpcomingCardProps> = ({ data }) => {
  const available = data.balance ? data.balance.total_days - data.balance.used_days : null;
  return (
    <Card className="shadow-card">
      <CardContent className="divide-y divide-border p-0">
        <Link to={ROUTES.EMPLOYEE.REQUESTS} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Sun className="h-5 w-5 shrink-0 text-gold" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Férias {new Date().getFullYear()}</p>
            <p className="font-medium">
              {available === null
                ? 'Saldo ainda não configurado'
                : `${formatDays(available)} dias disponíveis`}
              {data.pendingRequests > 0 && (
                <span className="ml-2 text-xs font-normal text-orange-600">
                  {data.pendingRequests} pendente{data.pendingRequests === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to={ROUTES.EMPLOYEE.REQUESTS} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-gold" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Próxima ausência</p>
            <p className="font-medium capitalize">
              {data.nextAbsence
                ? `${formatShortDate(data.nextAbsence.start_date)}${
                    data.nextAbsence.end_date !== data.nextAbsence.start_date
                      ? ` – ${formatShortDate(data.nextAbsence.end_date)}`
                      : ''
                  } · ${absenceTypeLabels[data.nextAbsence.absence_type] ?? data.nextAbsence.absence_type}`
                : 'Nenhuma marcada'}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        {data.nextHoliday && (
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <span className="text-lg leading-none">🎉</span>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Próximo feriado</p>
              <p className="font-medium capitalize">
                {formatShortDate(data.nextHoliday.date)} · {data.nextHoliday.name}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
