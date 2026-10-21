import React from 'react';
import { AdminNavLink } from './AdminNavLink';
import type { AdminNavGroup } from './adminNavigation';

interface AdminNavGroupsProps {
  groups: AdminNavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Números vermelhos por página (href → contagem). */
  badges?: Record<string, number>;
}

/** Os grupos do menu (Geral, Pessoas, Empresa, Apoio), no menu lateral e no do telemóvel. */
export const AdminNavGroups: React.FC<AdminNavGroupsProps> = ({
  groups,
  collapsed = false,
  onNavigate,
  badges = {},
}) => (
  <>
    {groups.map(group => (
      <div key={group.label}>
        {collapsed ? (
          <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
        ) : (
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {group.label}
          </p>
        )}
        <ul className="space-y-1">
          {group.items.map(item => (
            <li key={item.href}>
              <AdminNavLink
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badge={badges[item.href]}
              />
            </li>
          ))}
        </ul>
      </div>
    ))}
  </>
);
