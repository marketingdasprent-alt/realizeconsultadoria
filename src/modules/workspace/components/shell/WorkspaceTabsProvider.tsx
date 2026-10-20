import React from 'react';
import { WorkspaceTabsContext, useWorkspaceTabsState } from '../../hooks/useWorkspaceTabs';

/** Estado único das abas (a barra de cima e os ficheiros abertos usam o mesmo). */
export const WorkspaceTabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useWorkspaceTabsState();
  return <WorkspaceTabsContext.Provider value={value}>{children}</WorkspaceTabsContext.Provider>;
};
