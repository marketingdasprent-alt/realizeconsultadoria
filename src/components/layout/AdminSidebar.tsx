import React from 'react';
import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { BrandMark } from '@/modules/workspace/components/BrandMark';
import { AdminNavGroups } from './AdminNavGroups';
import { AdminNavLink } from './AdminNavLink';
import { AdminUserCard } from './AdminUserCard';
import type { AdminNavGroup, AdminNavItem } from './adminNavigation';

interface AdminSidebarProps {
  groups: AdminNavGroup[];
  settings: AdminNavItem | null;
  userName: string;
  userInitial: string;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  badges?: Record<string, number>;
}

/** Menu lateral do admin sobre a aurora (como o do colaborador), fixo à esquerda. */
export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  groups,
  settings,
  userName,
  userInitial,
  collapsed,
  onToggle,
  onLogout,
  badges,
}) => (
  <aside
    className={cn(
      'fixed inset-y-0 left-0 z-40 hidden flex-col transition-[width] duration-300 ease-out lg:flex print:hidden',
      collapsed ? 'w-[76px]' : 'w-[260px]'
    )}
    aria-label="Menu do admin"
  >
    <Link
      to={ROUTES.ADMIN.DASHBOARD}
      className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}
      aria-label="Realize — Dashboard"
    >
      <BrandMark withName={!collapsed} subtitle="Admin" />
    </Link>

    <nav className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-2">
      <AdminNavGroups groups={groups} collapsed={collapsed} badges={badges} />
    </nav>

    <div className="space-y-2 px-3 pb-4 pt-2">
      {settings && <AdminNavLink item={settings} collapsed={collapsed} />}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white',
          collapsed && 'justify-center px-0'
        )}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <>
            <PanelLeftClose className="ml-1.5 h-5 w-5" />
            <span>Recolher menu</span>
          </>
        )}
      </button>
      <AdminUserCard
        userName={userName}
        userInitial={userInitial}
        collapsed={collapsed}
        onLogout={onLogout}
      />
    </div>
  </aside>
);
