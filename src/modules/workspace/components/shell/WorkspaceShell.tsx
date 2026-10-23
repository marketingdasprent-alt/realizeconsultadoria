import React, { Suspense, lazy } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from '../../context/workspaceContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useRzTheme } from '../../hooks/useRzTheme';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { PushPrompt } from '../PushPrompt';
import { MobileTabBar } from './MobileTabBar';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceTabsProvider } from './WorkspaceTabsProvider';

// Ficheiros abertos dos Documentos (cada um na sua aba); carrega à parte da estrutura.
const OpenFilesHost = lazy(() => import('@/modules/documents/components/company/OpenFilesHost'));
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
      <WorkspaceTabsProvider>
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
              {/* Avisos push desligados neste dispositivo: convite no topo, em qualquer página. */}
              <PushPrompt className="mx-3 mt-3 md:mx-4" />
              {/* Abas como no Chrome (no telemóvel há a barra inferior). */}
              {isDesktop && <WorkspaceTabs />}
              <div className="relative min-h-0 flex-1">
                {children}
                <Suspense fallback={null}>
                  <OpenFilesHost />
                </Suspense>
              </div>
            </main>
          </div>
          <MobileTabBar />
        </div>
      </WorkspaceTabsProvider>
    </WorkspaceContext.Provider>
  );
};
