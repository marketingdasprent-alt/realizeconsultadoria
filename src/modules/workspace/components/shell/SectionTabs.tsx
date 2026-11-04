import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { cn } from '@/lib/utils';
import { useAdminAccess } from '../../hooks/useIsAdmin';
import { sectionFor } from '../../lib/sections';

/**
 * Separadores no topo das páginas que juntam a parte do colaborador e a de gestão (Férias,
 * Colaboradores, Tickets, Definições): só aparecem a administradores, com o que cada um pode ver.
 */
export const SectionTabs: React.FC = () => {
  const { pathname, search } = useLocation();
  const { isAdmin } = useAdminAccess();
  const { canView, isSuperAdmin, isLoading } = useAdminPermissions();
  const current = sectionFor(pathname);
  if (!current || !isAdmin || isLoading) return null;

  const tabs = current.section.tabs.filter(
    tab =>
      !tab.adminModule ||
      canView(tab.adminModule) ||
      (tab.adminModule === 'settings' && isSuperAdmin)
  );
  if (tabs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Secção"
      className="scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-4 md:px-8"
    >
      {tabs.map(tab => {
        const active = tab === current.tab;
        return (
          <Link
            key={tab.path}
            to={active ? `${pathname}${search}` : tab.path}
            role="tab"
            aria-selected={active}
            className={cn(
              'h-9 shrink-0 rounded-full px-4 text-[13px] font-bold leading-9',
              active
                ? 'bg-rz-ink text-white'
                : 'bg-white text-rz-muted ring-1 ring-rz-line hover:text-rz-ink'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};
