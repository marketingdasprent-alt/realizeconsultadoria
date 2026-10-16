import React from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from '../../context/workspaceContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useRzTheme } from '../../hooks/useRzTheme';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { MobileTabBar } from './MobileTabBar';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceTopBar } from './WorkspaceTopBar';

interface WorkspaceShellProps {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}

/**
 * Estrutura do Realize 2.0 (briefing §3): menu lateral e barra superior sobre a
 * aurora, e a área central num painel claro e arredondado. No telemóvel o menu
 * passa para uma barra inferior.
 */
export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ value, children }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  useRzTheme();

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="fixed inset-0 flex bg-rz-aurora font-jakarta text-rz-ink">
        <WorkspaceSidebar
          basePath={value.basePath}
          collapsed={!isDesktop || collapsed}
          canToggle={isDesktop}
          onToggle={toggleCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <WorkspaceTopBar />
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[28px] bg-rz-canvas shadow-rz-panel md:mb-3 md:mr-3 md:rounded-[28px]">
            {/* Abas como no Chrome (no telemóvel há a barra inferior). */}
            {isDesktop && <WorkspaceTabs />}
            <div className="relative min-h-0 flex-1">{children}</div>
          </main>
        </div>
        <MobileTabBar />
      </div>
    </WorkspaceContext.Provider>
  );
};
