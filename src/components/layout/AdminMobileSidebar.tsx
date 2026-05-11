import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  moduleKey: string;
}

interface AdminMobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  userName: string;
  userInitial: string;
  onLogout: () => void;
}

export const AdminMobileSidebar = ({
  isOpen,
  onClose,
  navItems,
  userName,
  userInitial,
  onLogout,
}: AdminMobileSidebarProps) => {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={onClose}>
      <aside className="w-64 bg-sidebar h-full pt-16" onClick={e => e.stopPropagation()}>
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

        <nav className="px-4 space-y-3">
          {navItems.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-colors ${
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar pb-20">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-12"
            onClick={onLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Terminar Sessão
          </Button>
        </div>
      </aside>
    </div>
  );
};
