import React from 'react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { modulePath, type WorkspaceModule } from '../../lib/navigation';
import { ModuleIcon } from '../ModuleIcon';

interface SidebarNavItemProps {
  module: WorkspaceModule;
  basePath: string;
  collapsed: boolean;
  badge?: number;
}

/** Entrada do menu lateral: mosaico colorido + nome; recolhido mostra só o ícone. */
export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  module,
  basePath,
  collapsed,
  badge,
}) => {
  const link = (
    <NavLink
      to={modulePath(basePath, module)}
      end={module.path === ''}
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
        module={module}
        size="sm"
        className="transition-transform duration-200 group-hover:scale-105"
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{module.label}</span>}
      {!collapsed && !module.ready && (
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white/50">
          Breve
        </span>
      )}
      {!!badge && (
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
        {module.label}
        {!module.ready && <span className="ml-1.5 text-muted-foreground">· em breve</span>}
      </TooltipContent>
    </Tooltip>
  );
};
