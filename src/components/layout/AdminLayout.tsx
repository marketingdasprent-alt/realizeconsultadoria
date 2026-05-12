import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  Settings,
  ClipboardList,
  Loader2,
  Headset,
  Lock,
  Scale,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/lib/constants';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileHeader } from './AdminMobileHeader';
import { AdminMobileSidebar } from './AdminMobileSidebar';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  moduleKey: string;
}

const allNavItems: NavItem[] = [
  {
    href: ROUTES.ADMIN.DASHBOARD,
    icon: LayoutDashboard,
    label: 'Dashboard',
    moduleKey: 'dashboard',
  },
  { href: ROUTES.ADMIN.LEGAL, icon: Scale, label: 'Jurídico', moduleKey: 'legal' },
  { href: ROUTES.ADMIN.COMPANIES, icon: Building2, label: 'Empresas', moduleKey: 'companies' },
  { href: ROUTES.ADMIN.EMPLOYEES, icon: Users, label: 'Colaboradores', moduleKey: 'employees' },
  { href: ROUTES.ADMIN.ACCESSES, icon: Lock, label: 'Acessos', moduleKey: 'accesses' },
  { href: ROUTES.ADMIN.REQUESTS, icon: ClipboardList, label: 'Pedidos', moduleKey: 'requests' },
  { href: ROUTES.ADMIN.SUPPORT, icon: Headset, label: 'Suporte', moduleKey: 'support' },
  { href: ROUTES.ADMIN.CALENDAR, icon: Calendar, label: 'Calendário', moduleKey: 'calendar' },
  { href: ROUTES.ADMIN.SETTINGS, icon: Settings, label: 'Configurações', moduleKey: 'settings' },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const { canView, isLoading: isLoadingPermissions, isSuperAdmin } = useAdminPermissions();

  const navItems = useMemo(() => {
    if (isLoadingPermissions) return [];
    return allNavItems.filter(item => {
      if (item.moduleKey === 'settings') {
        return isSuperAdmin || canView('settings') || canView('marketing');
      }
      return canView(item.moduleKey);
    });
  }, [canView, isLoadingPermissions, isSuperAdmin]);

  useEffect(() => {
    if (user) {
      setUserName(user.email?.split('@')[0] || 'Admin');
    }
  }, [user]);

  const userInitial = userName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Sessão terminada',
        description: 'Até breve!',
      });
      navigate(ROUTES.ADMIN.LOGIN);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao fazer logout',
        variant: 'destructive',
      });
    }
  };

  if (isLoadingPermissions) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">A carregar permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex overflow-x-hidden">
      <AdminSidebar
        navItems={navItems}
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      />

      <AdminMobileHeader
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        userInitial={userInitial}
      />

      <AdminMobileSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        navItems={navItems}
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      />

      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 print:ml-0 print:pt-0 overflow-x-hidden">
        <div className="p-4 lg:p-8 print:p-0 max-w-full">{children || <Outlet />}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
