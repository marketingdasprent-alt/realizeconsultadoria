import { Suspense, useMemo, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useRzTheme } from '@/modules/workspace/hooks/useRzTheme';
import { useSidebarCollapsed } from '@/modules/workspace/hooks/useSidebarCollapsed';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileHeader } from './AdminMobileHeader';
import { AdminMobileSidebar } from './AdminMobileSidebar';
import { ADMIN_SETTINGS_ITEM, visibleAdminGroups } from './adminNavigation';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

/**
 * Painel de administração no visual do Realize 2.0: menu lateral sobre a aurora e as páginas
 * num painel claro e arredondado. A página continua a deslizar na janela (impressões e
 * cabeçalhos das páginas antigas funcionam como antes).
 */
const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed('rz.admin.sidebar.collapsed');
  const { canView, isLoading: isLoadingPermissions, isSuperAdmin } = useAdminPermissions();

  useRzTheme();

  const groups = useMemo(
    () => (isLoadingPermissions ? [] : visibleAdminGroups(canView)),
    [canView, isLoadingPermissions]
  );
  const settings =
    !isLoadingPermissions && (isSuperAdmin || canView('settings') || canView('marketing'))
      ? ADMIN_SETTINGS_ITEM
      : null;

  const userName = user?.email?.split('@')[0] || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Sessão terminada', description: 'Até breve!' });
      navigate(ROUTES.ADMIN.LOGIN);
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao fazer logout',
        variant: 'destructive',
      });
    }
  };

  if (isLoadingPermissions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rz-aurora font-jakarta">
        <div className="flex flex-col items-center gap-4 text-white/70">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">A carregar permissões…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rz-aurora bg-fixed font-jakarta text-rz-ink print:bg-white">
      <AdminSidebar
        groups={groups}
        settings={settings}
        userName={userName}
        userInitial={userInitial}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onLogout={handleLogout}
      />

      <AdminMobileHeader isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      <AdminMobileSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        groups={groups}
        settings={settings}
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      />

      <div
        className={cn(
          'min-h-screen pt-14 transition-[padding] duration-300 ease-out lg:py-3 lg:pr-3 print:p-0',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'
        )}
      >
        <main className="min-h-[calc(100vh-3.5rem)] overflow-x-hidden rounded-t-[28px] bg-rz-canvas shadow-rz-panel lg:min-h-[calc(100vh-1.5rem)] lg:rounded-[28px] print:min-h-0 print:rounded-none print:bg-white print:shadow-none">
          <div className="mx-auto max-w-[1600px] p-4 lg:p-8 print:max-w-none print:p-0">
            {children || (
              <Suspense
                fallback={
                  <div className="py-16 text-center text-sm text-rz-muted">A carregar…</div>
                }
              >
                <Outlet />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
