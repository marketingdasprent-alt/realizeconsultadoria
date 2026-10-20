import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ClipboardList } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAdminBadges } from '../hooks/useAdminBadges';
import { CalendarTab } from '../components/calendar/CalendarTab';

// Os pedidos (com as impressões) carregam à parte do calendário.
const RequestsTab = lazy(() => import('../components/requests/RequestsTab'));

type PageTab = 'calendario' | 'pedidos';

const TABS = [
  { value: 'calendario', label: 'Calendário', icon: CalendarDays, moduleKey: 'calendar' },
  { value: 'pedidos', label: 'Pedidos', icon: ClipboardList, moduleKey: 'requests' },
] as const;

interface PageTabsProps {
  tabs: readonly (typeof TABS)[number][];
  value: PageTab;
  pending: number;
  onChange: (tab: PageTab) => void;
}

const PageTabs: React.FC<PageTabsProps> = ({ tabs, value, pending, onChange }) => (
  <div
    role="tablist"
    className="flex gap-1 rounded-full bg-white p-1 shadow-rz-soft ring-1 ring-rz-line"
  >
    {tabs.map(({ value: tab, label, icon: Icon }) => (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={value === tab}
        onClick={() => onChange(tab)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold transition-colors',
          value === tab ? 'bg-rz-primary text-white' : 'text-rz-muted hover:text-rz-ink'
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
        {tab === 'pedidos' && pending > 0 && (
          <span
            className={cn(
              'rounded-full px-1.5 text-[11.5px]',
              value === tab ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
            )}
          >
            {pending}
          </span>
        )}
      </button>
    ))}
  </div>
);

/** Férias e Ausências: o calendário da equipa e os pedidos (aprovar, rejeitar, marcar). */
const CalendarPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView, isLoading } = useAdminPermissions();
  const pending = useAdminBadges()[ROUTES.ADMIN.CALENDAR] ?? 0;

  const allowed = TABS.filter(tab => isLoading || canView(tab.moduleKey));
  const asked: PageTab = searchParams.get('tab') === 'pedidos' ? 'pedidos' : 'calendario';
  const tab = allowed.some(item => item.value === asked) ? asked : (allowed[0]?.value ?? asked);
  const change = (next: PageTab) =>
    setSearchParams(next === 'pedidos' ? { tab: 'pedidos' } : {}, { replace: true });

  const tabs =
    allowed.length > 1 ? (
      <PageTabs tabs={allowed} value={tab} pending={pending} onChange={change} />
    ) : (
      <span />
    );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Férias e Ausências"
        description="Quem está fora, pedidos por aprovar e saldos da equipa"
        className="print:hidden"
      />
      {tab === 'pedidos' ? (
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-[28px] bg-white/70 ring-1 ring-rz-line" />
          }
        >
          <RequestsTab tabs={tabs} />
        </Suspense>
      ) : (
        <CalendarTab tabs={tabs} />
      )}
    </div>
  );
};

export default CalendarPage;
