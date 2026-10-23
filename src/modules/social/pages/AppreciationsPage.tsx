import React, { useState } from 'react';
import { Award, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppreciationsCard } from '@/modules/workspace/components/profile/AppreciationsCard';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { AppreciationCard } from '../components/AppreciationCard';
import { SendAppreciationDialog } from '../components/SendAppreciationDialog';
import { useAppreciations } from '../hooks/useAppreciations';

type Tab = 'received' | 'sent' | 'company';

const TABS: { key: Tab; label: string }[] = [
  { key: 'received', label: 'Recebidas' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'company', label: 'Na empresa' },
];

/** Apreciações (briefing §7): recebidas, enviadas e as públicas da empresa. Sem rankings. */
const AppreciationsPage: React.FC = () => {
  const { user } = useWorkspace();
  const mine = useAppreciations({ userId: user.userId });
  const company = useAppreciations('public');
  const [tab, setTab] = useState<Tab>('received');
  const [isSending, setIsSending] = useState(false);
  const list = tab === 'received' ? mine.received : tab === 'sent' ? mine.sent : company.items;
  const isLoading = tab === 'company' ? company.isLoading : mine.isLoading;

  return (
    <WorkspacePage>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Apreciações</h1>
          <p className="text-sm text-rz-muted">Reconheça o bom trabalho dos seus colegas.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsSending(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_hsl(var(--rz-primary))]"
        >
          <Award className="h-4 w-4" /> Enviar apreciação
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="flex gap-2">
            {TABS.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => setTab(option.key)}
                className={cn(
                  'rounded-full px-4 py-2 text-[13px] font-semibold',
                  tab === option.key
                    ? 'bg-rz-ink text-white'
                    : 'bg-white text-rz-muted ring-1 ring-rz-line'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <Loader2 className="mx-auto mt-10 h-7 w-7 animate-spin text-rz-primary" />
          ) : list.length === 0 ? (
            <p className="rounded-[28px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
              {tab === 'sent' ? 'Ainda não enviou apreciações.' : 'Ainda não há apreciações aqui.'}
            </p>
          ) : (
            list.map(item => (
              <AppreciationCard
                key={item.id}
                appreciation={item}
                onReact={tab === 'company' ? company.react : mine.react}
              />
            ))
          )}
        </div>
        <div className="hidden lg:block">
          <AppreciationsCard received={mine.received} isOwn />
        </div>
      </div>

      <SendAppreciationDialog open={isSending} onOpenChange={setIsSending} onSend={mine.send} />
    </WorkspacePage>
  );
};

export default AppreciationsPage;
