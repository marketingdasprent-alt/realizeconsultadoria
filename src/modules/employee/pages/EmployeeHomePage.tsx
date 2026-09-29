import React, { useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { buildHomeAlerts, getSafetyCheckupStatus } from '@/lib/employee-home';
import { HomeAlerts } from '../components/home/HomeAlerts';
import { NoticesPreview } from '../components/home/NoticesPreview';
import { QuickActions } from '../components/home/QuickActions';
import { TimeSummaryCard } from '../components/home/TimeSummaryCard';
import { UpcomingCard } from '../components/home/UpcomingCard';
import { useEmployeeHome } from '../hooks/useEmployeeHome';
import { useEmployeeOutlet } from '../hooks/useEmployeeOutlet';

const ALERT_ROUTES = {
  requests: ROUTES.EMPLOYEE.REQUESTS,
  timeclock: ROUTES.EMPLOYEE.TIMECLOCK,
  documents: ROUTES.EMPLOYEE.DOCUMENTS,
  notices: ROUTES.EMPLOYEE.NOTICES,
  more: ROUTES.EMPLOYEE.MORE,
};

/** Início: o que preciso hoje, do mais frequente para o menos. */
const EmployeeHomePage: React.FC = () => {
  const { employee } = useEmployeeOutlet();
  const { data, isLoading } = useEmployeeHome(employee.company_id, employee.id);
  const [incompleteDays, setIncompleteDays] = useState(0);
  const handleIncomplete = useCallback((n: number) => setIncompleteDays(n), []);

  const alerts = useMemo(
    () =>
      data
        ? buildHomeAlerts({
            data,
            incompleteDays,
            safety: getSafetyCheckupStatus(
              employee.safety_checkup_date,
              employee.safety_checkup_renewal_months
            ),
            routes: ALERT_ROUTES,
          })
        : [],
    [data, incompleteDays, employee.safety_checkup_date, employee.safety_checkup_renewal_months]
  );

  return (
    <div className="space-y-5">
      <TimeSummaryCard employeeId={employee.id} onIncompleteDays={handleIncomplete} />

      {isLoading || !data ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <>
          <HomeAlerts alerts={alerts} />
          <NoticesPreview notices={data.notices} unread={data.unreadNotices} />
          <UpcomingCard data={data} />
          <QuickActions />
        </>
      )}
    </div>
  );
};

export default EmployeeHomePage;
