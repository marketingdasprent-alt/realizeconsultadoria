import React from 'react';
import { Navigate } from 'react-router-dom';
import { Headset, Loader2 } from 'lucide-react';
import { SupportDesk } from '@/modules/admin/components/support/SupportDesk';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useDeskTickets, useSupportDesk } from '../hooks/useSupportDesk';

/** Suporte no Workspace: a equipa responde aos tickets do seu departamento sem ir ao admin. */
const SupportDeskPage: React.FC = () => {
  const { basePath } = useWorkspace();
  const desk = useSupportDesk();
  const queue = useDeskTickets(desk.isAgent);

  if (desk.isLoading)
    return <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-rz-primary" />;
  if (!desk.isAgent) return <Navigate to={`${basePath}/tickets`} replace />;

  return (
    <WorkspacePage width="full">
      <SupportDesk
        tickets={queue.tickets}
        isLoading={queue.isLoading}
        refetch={queue.refetch}
        updateTicketStatus={queue.updateTicketStatus}
        departments={desk.departments}
        className="h-[calc(100dvh-11rem)]"
        renderHeader={summary => (
          <header className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-rz-soft">
              <Headset className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-[22px] font-extrabold leading-tight">
                Suporte · {desk.departments.map(d => d.name).join(', ')}
              </h1>
              <p className="text-[13px] text-rz-muted">{summary}</p>
            </div>
          </header>
        )}
      />
    </WorkspacePage>
  );
};

export default SupportDeskPage;
