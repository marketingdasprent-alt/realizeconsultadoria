import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { modulePath, type WorkspaceModule } from '../../lib/navigation';
import { sectionFor } from '../../lib/sections';
import { ModuleIcon } from '../ModuleIcon';

interface SidebarNavItemProps {
  module: WorkspaceModule;
  basePath: string;
  collapsed: boolean;
  badge?: number;
  /** Escudo de "só administradores" (nas entradas de admin fora da secção Gestão). */
  adminMark?: boolean;
}

/** Entrada do menu lateral: mosaico colorido + nome; recolhido mostra só o ícone. */
export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  module,
  basePath,
  collapsed,
  badge,
  adminMark = false,
}) => {
  // Separador de gestão de uma página junta (ex.: /admin/calendario) acende a entrada dela
  const { pathname } = useLocation();
  const inSection = sectionFor(pathname)?.section.module === module.key;
  const link = (
    <NavLink
      to={modulePath(basePath, module)}
      // A página inicial e o Painel do admin só ficam ativos no próprio endereço
      end={module.path === '' || module.path === '/admin'}
      className={({ isActive: exact }) => {
        const isActive = exact || inSection;
        return cn(
          'group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[14px] font-medium transition-all duration-200',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]'
            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'
        );
      }}
    >
      <ModuleIcon
        module={module}
        size="sm"
        className="transition-transform duration-200 group-hover:scale-105"
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{module.label}</span>}
      {!collapsed && adminMark && module.key.startsWith('admin:') && (
        <ShieldCheck
          className="h-3.5 w-3.5 shrink-0 text-amber-200/80"
          aria-label="Só administradores"
        />
      )}
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
