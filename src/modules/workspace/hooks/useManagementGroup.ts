import { useMemo } from 'react';
import { visibleAdminGroups, type AdminNavItem } from '@/components/layout/adminNavigation';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import type { WorkspaceGroup, WorkspaceModule } from '../lib/navigation';
import { MERGED_ADMIN_PATHS } from '../lib/sections';
import { useAdminAccess } from './useIsAdmin';

/** Nome da secção das páginas só de administração. */
export const MANAGEMENT_LABEL = 'Gestão';

/** Páginas do admin que vão para um grupo do Workspace (as outras ficam na Gestão). */
const GROUP_OF: Record<string, string> = {
  [ROUTES.ADMIN.BROADCASTS]: 'Comunicação',
};

const toModule = (item: AdminNavItem): WorkspaceModule => ({
  key: `admin:${item.moduleKey}:${item.href}`,
  label: item.label,
  // Caminho absoluto: as páginas do admin abrem dentro do Workspace (rotas /admin/…)
  path: item.href,
  icon: item.icon,
  tint: item.tint,
  ready: true,
  description: item.label,
});

/**
 * Menu do Workspace com as partes de admin no sítio certo: cada página de admin entra no grupo
 * a que pertence (Comunicados em Comunicação); as que já estão dentro de uma página do
 * colaborador (Ponto, Férias, Colaboradores, Tickets, Configurações) não se repetem; o resto
 * fica na secção Gestão. Para quem não é administrador, os grupos ficam como estão.
 */
export const useAdminMenu = (groups: WorkspaceGroup[]): WorkspaceGroup[] => {
  const { isAdmin } = useAdminAccess();
  const { canView, isLoading } = useAdminPermissions();

  return useMemo(() => {
    if (!isAdmin || isLoading) return groups;
    const items = visibleAdminGroups(canView)
      .flatMap(group => group.items)
      .filter(item => !MERGED_ADMIN_PATHS.has(item.href));
    const extra = new Map<string, WorkspaceModule[]>();
    const management: WorkspaceModule[] = [];
    for (const item of items) {
      const target = GROUP_OF[item.href];
      if (target) extra.set(target, [...(extra.get(target) ?? []), toModule(item)]);
      else management.push(toModule(item));
    }
    const merged = groups.map(group => ({
      ...group,
      modules: [...group.modules, ...(extra.get(group.label) ?? [])],
    }));
    return management.length
      ? [...merged, { label: MANAGEMENT_LABEL, modules: management }]
      : merged;
  }, [groups, isAdmin, isLoading, canView]);
};
