import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-realize.png';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  moduleKey: string;
}

interface AdminSidebarProps {
  navItems: NavItem[];
  userName: string;
  userInitial: string;
  onLogout: () => void;
}

export const AdminSidebar = ({ navItems, userName, userInitial, onLogout }: AdminSidebarProps) => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-sidebar fixed inset-y-0 left-0 z-50 print:hidden">
      <div className="p-4 flex justify-center">
        <img src={logo} alt="Realize Consultadoria" className="h-16 w-auto brightness-0 invert" />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <nav className="px-3 py-4 flex flex-col gap-[5px]">
          {navItems.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
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

      <div className="p-4 border-t border-sidebar-border mt-auto mb-2">
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
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Terminar Sessão
        </Button>
      </div>
    </aside>
  );
};
