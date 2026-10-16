import React from 'react';
import { AdminNavGroups } from './AdminNavGroups';
import { AdminNavLink } from './AdminNavLink';
import { AdminUserCard } from './AdminUserCard';
import type { AdminNavGroup, AdminNavItem } from './adminNavigation';

interface AdminMobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  groups: AdminNavGroup[];
  settings: AdminNavItem | null;
  userName: string;
  userInitial: string;
  onLogout: () => void;
}

/** Menu do telemóvel/tablet: abre por baixo da barra do topo, com os mesmos grupos. */
export const AdminMobileSidebar: React.FC<AdminMobileSidebarProps> = ({
  isOpen,
  onClose,
  groups,
  settings,
  userName,
  userInitial,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose}>
      <aside
        className="flex h-full w-72 flex-col bg-rz-aurora pt-14"
        onClick={event => event.stopPropagation()}
      >
        <nav className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <AdminNavGroups groups={groups} onNavigate={onClose} />
        </nav>
        <div className="space-y-2 px-3 pb-6 pt-2">
          {settings && <AdminNavLink item={settings} onNavigate={onClose} />}
          <AdminUserCard userName={userName} userInitial={userInitial} onLogout={onLogout} />
        </div>
      </aside>
    </div>
  );
};
