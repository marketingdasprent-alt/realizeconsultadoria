import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History, PenLine } from 'lucide-react';
import { AdminPageTitle } from '@/components/admin/AdminPageHeader';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { cn } from '@/lib/utils';
import { BroadcastComposeTab } from '../components/broadcasts/BroadcastComposeTab';
import { BroadcastSentTab } from '../components/broadcasts/BroadcastSentTab';
import { useBroadcasts } from '../hooks/useBroadcasts';
import { broadcastService } from '../services/broadcastService';

const TABS = [
  { value: 'novo', label: 'Novo', icon: PenLine },
  { value: 'enviados', label: 'Enviados', icon: History },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Pessoas → Comunicados: escrever (Novo) e o que já foi (Enviados, com as confirmações). */
const BroadcastsPage: React.FC = () => {
  const { canExecuteTopic, isLoading: loadingPermissions } = useAdminPermissions();
  const canSend = canExecuteTopic('marketing', 'email');
  const companies =
    useQuery({
      queryKey: ['admin', 'companies-active'],
      queryFn: broadcastService.companies,
      staleTime: 5 * 60_000,
    }).data ?? [];
  const bc = useBroadcasts(companies);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'enviados' ? 'enviados' : 'novo';
  const change = (next: Tab) => setParams(next === 'novo' ? {} : { tab: next }, { replace: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AdminPageTitle
          title="Comunicados"
          description="Um email para os colaboradores — e, se quiser, o mesmo aviso na app"
        />
        <div
          role="tablist"
          className="flex gap-1 rounded-full bg-white p-1 shadow-rz-soft ring-1 ring-rz-line"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => change(value)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold transition-colors',
                tab === value ? 'bg-rz-primary text-white' : 'text-rz-muted hover:text-rz-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {value === 'enviados' && bc.history.length > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11.5px]',
                    tab === value ? 'bg-white/25 text-white' : 'bg-rz-canvas text-rz-muted'
                  )}
                >
                  {bc.history.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'novo' ? (
        <BroadcastComposeTab
          bc={bc}
          companies={companies}
          canSend={canSend}
          loadingPermissions={loadingPermissions}
          onSent={() => change('enviados')}
        />
      ) : (
        <BroadcastSentTab
          rows={bc.history}
          isLoading={bc.historyLoading}
          people={bc.people}
          canRemind={canSend}
        />
      )}
    </div>
  );
};

export default BroadcastsPage;
