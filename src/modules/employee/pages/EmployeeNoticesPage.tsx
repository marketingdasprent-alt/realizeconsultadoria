import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Bell, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { HomeNotice } from '@/lib/employee-home';
import { useEmployeeOutlet } from '../hooks/useEmployeeOutlet';
import { employeeHomeService } from '../services/employeeHomeService';

/** Todos os avisos; abrir a página marca-os como lidos. */
const EmployeeNoticesPage: React.FC = () => {
  const { employee } = useEmployeeOutlet();
  const [notices, setNotices] = useState<HomeNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    employeeHomeService.getNotices(employee.company_id, employee.id).then(({ data }) => {
      if (cancelled) return;
      setNotices(data);
      setIsLoading(false);
      const unread = data.filter(n => !n.read).map(n => n.id);
      if (unread.length) employeeHomeService.markNoticesRead(employee.id, unread);
    });
    return () => {
      cancelled = true;
    };
  }, [employee.company_id, employee.id]);

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Bell className="h-5 w-5 text-gold" /> Avisos
      </h1>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : notices.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem avisos de momento.</p>
      ) : (
        <div className="space-y-3">
          {notices.map(n => (
            <Card key={n.id} className={`shadow-card ${n.read ? '' : 'border-red-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{n.title}</h2>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(n.created_at), 'd MMM yyyy', { locale: pt })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {n.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeNoticesPage;
