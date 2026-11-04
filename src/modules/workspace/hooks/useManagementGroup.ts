import { useMemo } from 'react';
import { ADMIN_SETTINGS_ITEM, visibleAdminGroups } from '@/components/layout/adminNavigation';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import type { WorkspaceGroup, WorkspaceModule } from '../lib/navigation';
import { useAdminAccess } from './useIsAdmin';

/**
 * Secção "Gestão" do menu do Workspace: as páginas do admin que esta pessoa pode ver (as
 * mesmas permissões do painel de administração). null para quem não é administrador.
 */
export const useManagementGroup = (): WorkspaceGroup | null => {
  const { isAdmin } = useAdminAccess();
  const { canView, isSuperAdmin, isLoading } = useAdminPermissions();

  return useMemo(() => {
    if (!isAdmin || isLoading) return null;
    // O Ponto do admin está na página Ponto do Workspace (separadores de gestão): não se repete
    const items = visibleAdminGroups(canView)
      .flatMap(group => group.items)
      .filter(item => item.href !== ROUTES.ADMIN.TIMECLOCK);
    if (isSuperAdmin || canView('settings')) items.push(ADMIN_SETTINGS_ITEM);
    const modules: WorkspaceModule[] = items.map(item => ({
      key: `admin:${item.moduleKey}:${item.href}`,
      label: item.label,
      // Caminho absoluto: as páginas do admin abrem dentro do Workspace (rotas /admin/…)
      path: item.href,
      icon: item.icon,
      tint: item.tint,
      ready: true,
      description: item.label,
    }));
    return modules.length ? { label: 'Gestão', modules } : null;
  }, [isAdmin, isLoading, canView, isSuperAdmin]);
};
