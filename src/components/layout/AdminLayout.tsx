import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Loader2,
  Headset,
  Lock,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import logo from "@/assets/logo-realize.png";

interface AdminLayoutProps {
  children?: React.ReactNode;
}

type AuthStatus = "checking" | "authorized" | "unauthorized";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  moduleKey: string;
}

const allNavItems: NavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", moduleKey: "dashboard" },
  { href: "/admin/juridico", icon: Scale, label: "Jurídico", moduleKey: "legal" },
  { href: "/admin/empresas", icon: Building2, label: "Empresas", moduleKey: "companies" },
  { href: "/admin/colaboradores", icon: Users, label: "Colaboradores", moduleKey: "employees" },
  { href: "/admin/acessos", icon: Lock, label: "Acessos", moduleKey: "accesses" },
  { href: "/admin/pedidos", icon: ClipboardList, label: "Pedidos", moduleKey: "requests" },
  { href: "/admin/suporte", icon: Headset, label: "Suporte", moduleKey: "support" },
  { href: "/admin/calendario", icon: Calendar, label: "Calendário", moduleKey: "calendar" },
  { href: "/admin/configuracoes", icon: Settings, label: "Configurações", moduleKey: "settings" },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const { canView, isLoading: isLoadingPermissions, isSuperAdmin } = useAdminPermissions();

  // Filter nav items based on permissions
  const navItems = useMemo(() => {
    if (isLoadingPermissions) return [];
    return allNavItems.filter(item => {
      // Módulo Jurídico exclusivo para Dinis ou departamento Jurídico
      if (item.moduleKey === 'legal') {
        const isDinis = userName.toLowerCase().includes("dinis silva");
        return isDinis || userDepartment === "Jurídico";
      }
      // Módulo de acessos exclusivo para super admins
      if (item.moduleKey === 'accesses') {
        return isSuperAdmin;
      }
      return canView(item.moduleKey);
    });
  }, [canView, isLoadingPermissions, isSuperAdmin, userName, userDepartment]);

  // Get first initial for avatar
  const userInitial = userName.charAt(0).toUpperCase();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setAuthStatus("unauthorized");
          navigate('/admin/login');
          return;
        }

        // Check if user must set password first
        if (session.user.user_metadata?.must_set_password === true) {
          navigate('/auth/set-password?mode=admin');
          return;
        }

        const { data: hasAdminRole, error: rolesError } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });

        if (rolesError) {
          console.error("Error checking roles:", rolesError);
          setAuthStatus("unauthorized");
          navigate('/admin/login');
          return;
        }

        if (!hasAdminRole) {
          setAuthStatus("unauthorized");
          navigate('/colaborador');
          localStorage.setItem("auth_preference", "employee");
          return;
        }

        // Defer setAuthStatus to after profile fetch to prevent UI flicker

        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profile) {
          setUserName(profile.name);
        }

        const { data: employeeData } = await supabase
          .from('employees')
          .select('department')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (employeeData) {
          setUserDepartment(employeeData.department);
        }

        // Finally set as authorized and show layout
        setAuthStatus("authorized");
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthStatus("unauthorized");
        navigate('/admin/login');
      }
    };

    checkAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Sessão terminada",
      description: "Até breve!",
    });
    navigate('/');
  };

  // Show loading state until auth is confirmed
  if (authStatus === "checking" || isLoadingPermissions) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">A verificar autenticação...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authorized
  if (authStatus === "unauthorized") {
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary flex overflow-x-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-sidebar fixed inset-y-0 left-0 z-50 print:hidden">
        <div className="p-4 flex justify-center">
          <img
            src={logo}
            alt="Realize Consultadoria"
            className="h-16 w-auto brightness-0 invert"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <nav className="px-3 py-2 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

          <div className="p-4 border-t border-sidebar-border mb-4">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center text-sm font-semibold text-sidebar-primary-foreground">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
              <p className="text-xs text-sidebar-foreground/60">Administrador</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Terminar Sessão
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 lg:h-16 bg-sidebar z-50 flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Realize Consultadoria"
            className="h-10 lg:h-16 w-auto brightness-0 invert"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* User avatar on mobile */}
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center text-sm font-semibold text-sidebar-primary-foreground">
            {userInitial}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-sidebar-foreground p-2"
          >
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsSidebarOpen(false)}>
          <aside
            className="w-64 bg-sidebar h-full pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info at top of mobile sidebar */}
            <div className="px-4 py-3 border-b border-sidebar-border mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sidebar-primary rounded-full flex items-center justify-center text-base font-semibold text-sidebar-primary-foreground">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                  <p className="text-xs text-sidebar-foreground/60">Administrador</p>
                </div>
              </div>
            </div>

            <nav className="px-4 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-colors ${isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar pb-20">
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-12"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Terminar Sessão
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 print:ml-0 print:pt-0 overflow-x-hidden">
        <div className="p-4 lg:p-8 print:p-0 max-w-full">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
