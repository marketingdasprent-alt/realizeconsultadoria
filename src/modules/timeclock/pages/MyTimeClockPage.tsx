import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { MyTimeClockPanel } from '../components/employee/MyTimeClockPanel';

// As partes de admin só se carregam para quem as pode ver (o colaborador não descarrega nada).
const TimeClockTeamTabs = lazy(() => import('../components/admin/TimeClockTeamTabs'));

/** Separadores: "O meu ponto" para toda a gente; os outros só para quem gere o ponto. */
const TABS = [
  { key: 'meu', label: 'O meu ponto' },
  { key: 'hoje', label: 'Equipa hoje' },
  { key: 'folha', label: 'Folha de ponto' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'locais', label: 'Locais e tags' },
  { key: 'historico', label: 'Histórico' },
] as const;
export type TimeClockTab = (typeof TABS)[number]['key'];

/**
 * Ponto: o colaborador vê o seu ponto; quem gere o ponto (admin, também pela conta de
 * colaborador ligada à de admin) vê na mesma página a equipa, a folha, a revisão, os locais e
 * o histórico. O servidor volta a verificar tudo (RLS).
 */
const MyTimeClockPage: React.FC = () => {
  const { isPreview } = useWorkspace();
  const permissions = useAdminPermissions();
  const manages = !isPreview && !permissions.isLoading && permissions.canView('timeclock');
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab') as TimeClockTab | null;
  const tab: TimeClockTab = manages && asked && TABS.some(t => t.key === asked) ? asked : 'meu';

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Ponto</h1>
      {manages && (
        <div
          className="scrollbar-hide mb-5 flex gap-1.5 overflow-x-auto"
          role="tablist"
          aria-label="Ponto"
        >
          {TABS.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() =>
                setParams(item.key === 'meu' ? {} : { tab: item.key }, { replace: true })
              }
              className={cn(
                'h-9 shrink-0 rounded-full px-4 text-[13px] font-bold',
                tab === item.key
                  ? 'bg-rz-ink text-white'
                  : 'bg-white text-rz-muted ring-1 ring-rz-line hover:text-rz-ink'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'meu' ? (
        <MyTimeClockPanel />
      ) : (
        <Suspense
          fallback={<Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-rz-primary" />}
        >
          <TimeClockTeamTabs tab={tab} permissions={permissions} />
        </Suspense>
      )}
    </WorkspacePage>
  );
};

export default MyTimeClockPage;
