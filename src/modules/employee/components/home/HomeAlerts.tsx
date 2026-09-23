import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Info } from 'lucide-react';
import type { HomeAlert } from '@/lib/employee-home';

interface HomeAlertsProps {
  alerts: HomeAlert[];
}

/** Lista de alertas do Início; cada um leva ao separador onde se resolve. */
export const HomeAlerts: React.FC<HomeAlertsProps> = ({ alerts }) => {
  if (alerts.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Alertas">
      {alerts.map(alert => {
        const warning = alert.tone === 'warning';
        return (
          <li key={alert.id}>
            <Link
              to={alert.to}
              className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                warning
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100'
                  : 'border-border bg-background'
              }`}
            >
              {warning ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              ) : (
                <Info className="h-5 w-5 shrink-0 text-gold" />
              )}
              <span className="flex-1">{alert.text}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
