import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants';
import type { HomeNotice } from '@/lib/employee-home';

interface NoticesPreviewProps {
  notices: HomeNotice[];
  unread: number;
}

/** Os avisos mais recentes; a lista completa está em /colaborador/avisos. */
export const NoticesPreview: React.FC<NoticesPreviewProps> = ({ notices, unread }) => (
  <Card className="shadow-card">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="flex items-center gap-2 font-display text-lg">
        <Bell className="h-5 w-5 text-gold" /> Avisos
        {unread > 0 && <Badge className="bg-red-500 hover:bg-red-500">{unread}</Badge>}
      </CardTitle>
      <Link
        to={ROUTES.EMPLOYEE.NOTICES}
        className="text-sm text-gold underline-offset-2 hover:underline"
      >
        Ver todos
      </Link>
    </CardHeader>
    <CardContent>
      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem avisos de momento.</p>
      ) : (
        <ul className="divide-y divide-border">
          {notices.map(n => (
            <li key={n.id} className="py-2 first:pt-0 last:pb-0">
              <Link to={ROUTES.EMPLOYEE.NOTICES} className="block">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.read ? 'font-medium' : 'font-semibold'}`}>
                    {!n.read && (
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                    )}
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(n.created_at), 'dd/MM')}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);
