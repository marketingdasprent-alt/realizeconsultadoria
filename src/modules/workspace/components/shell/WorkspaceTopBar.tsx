import React from 'react';
import { Link } from 'react-router-dom';
import { AccountSwitchButton } from '@/modules/auth/components/AccountSwitchButton';
import { useWorkspace } from '../../context/workspaceContext';
import { BrandMark } from '../BrandMark';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsButton } from './NotificationsButton';
import { ProfileMenu } from './ProfileMenu';
import { WorkspaceClock } from './WorkspaceClock';

/**
 * Barra superior global (briefing §3A): pesquisa, "Ir para admin" (quem também é admin),
 * notificações, relógio do ponto e perfil.
 */
export const WorkspaceTopBar: React.FC = () => {
  const { basePath, isPreview } = useWorkspace();
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-3 md:pl-1 md:pr-4">
      <Link to={basePath} className="md:hidden" aria-label="Realize — Mensagens">
        <BrandMark withName={false} />
      </Link>
      <div className="hidden min-w-0 flex-1 md:block">
        <GlobalSearch />
      </div>
      <div className="flex-1 md:hidden" />
      {isPreview && (
        <span className="hidden rounded-full bg-amber-300/90 px-3 py-1 text-xs font-bold text-amber-950 lg:inline">
          Pré-visualização · dados de exemplo
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          <GlobalSearch compact />
        </div>
        <AccountSwitchButton
          current="workspace"
          className="rz-glass text-white hover:bg-white/20"
        />
        <NotificationsButton />
        <WorkspaceClock />
        <ProfileMenu />
      </div>
    </header>
  );
};
