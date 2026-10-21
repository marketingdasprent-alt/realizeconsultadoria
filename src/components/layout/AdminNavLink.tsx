import React from 'react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import type { AdminNavItem } from './adminNavigation';

interface AdminNavLinkProps {
  item: AdminNavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Número vermelho (ex.: tickets abertos); 0 não mostra. */
  badge?: number;
}

/** Entrada do menu do admin: mosaico colorido + nome; recolhido mostra só o ícone. */
export const AdminNavLink: React.FC<AdminNavLinkProps> = ({
  item,
  collapsed = false,
  onNavigate,
  badge = 0,
}) => {
  const link = (
    <NavLink
      to={item.href}
      end={item.href === ROUTES.ADMIN.DASHBOARD}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[14px] font-medium transition-all duration-200',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]'
            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
        )
      }
    >
      <ModuleIcon
        module={item}
        size="sm"
        className="transition-transform duration-200 group-hover:scale-105"
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {badge > 0 && (
        <span
          className={cn(
            'min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white',
            collapsed && 'absolute right-1.5 top-1'
          )}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="rounded-xl font-medium">
        {item.label}
        {badge > 0 && ` · ${badge}`}
      </TooltipContent>
    </Tooltip>
  );
};
