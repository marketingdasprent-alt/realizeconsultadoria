import React from 'react';
import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { useFeedUnread } from '@/modules/social/hooks/useFeedUnread';
import { useNotices } from '@/modules/social/hooks/useNotices';
import { useSupportDesk } from '@/modules/support/hooks/useSupportDesk';
import { useMailUnreadTotal } from '@/modules/webmail/hooks/useMailUnreadTotal';
import { MANAGEMENT_LABEL, useAdminMenu } from '../../hooks/useManagementGroup';
import { SETTINGS_MODULE, visibleGroups } from '../../lib/navigation';
import { BrandMark } from '../BrandMark';
import { SidebarNavItem } from './SidebarNavItem';

interface WorkspaceSidebarProps {
  basePath: string;
  collapsed: boolean;
  /** Em tablets o menu fica sempre recolhido (sem botão para expandir). */
  canToggle: boolean;
  onToggle: () => void;
}

/** Menu lateral sobre a aurora: módulos agrupados por função (briefing §4). */
export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  basePath,
  collapsed,
  canToggle,
  onToggle,
}) => {
  // Não lidas do Messenger (fora do provider, ex.: testes, não mostra nada).
  const unread = useOptionalMessenger()?.unreadTotal ?? 0;
  // Comunicados dos RH por confirmar (no Feed).
  const { unread: noticesUnread } = useNotices();
  // Publicações e reconhecimentos novos desde a última visita ao Feed.
  const { count: feedNew } = useFeedUnread();
  // Emails por ler na Entrada de todas as caixas.
  const mailUnread = useMailUnreadTotal();
  const { isAgent } = useSupportDesk();
  // Administradores: as páginas do admin no mesmo menu (cada uma no seu grupo, resto em Gestão)
  const groups = useAdminMenu(visibleGroups({ supportDesk: isAgent }));
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col transition-[width] duration-300 ease-out md:flex',
        collapsed ? 'w-[76px]' : 'w-[260px]'
      )}
      aria-label="Menu principal"
    >
      <Link
        to={basePath}
        className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}
        aria-label="Realize — Mensagens"
      >
        <BrandMark withName={!collapsed} />
      </Link>

      <nav className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-2">
        {groups.map(group => {
          // A secção Gestão (só administradores) fica num bloco à parte, com fundo próprio
          const isManagement = group.label === MANAGEMENT_LABEL;
          return (
            <div
              key={group.label}
              className={cn(
                isManagement && 'rounded-[22px] bg-amber-300/[0.08] p-1.5 ring-1 ring-amber-200/20'
              )}
            >
              {collapsed ? (
                isManagement ? (
                  <ShieldCheck
                    className="mx-auto mb-1.5 mt-1 h-4 w-4 text-amber-200/80"
                    aria-label="Gestão"
                  />
                ) : (
                  <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
                )
              ) : (
                <p
                  className={cn(
                    'mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em]',
                    isManagement ? 'pt-1.5 text-amber-200/90' : 'text-white/45'
                  )}
                >
                  {isManagement && <ShieldCheck className="h-3.5 w-3.5" />}
                  {group.label}
                  {isManagement && (
                    <span className="ml-auto rounded-full bg-amber-200/15 px-1.5 py-px text-[9.5px] tracking-wide">
                      Admin
                    </span>
                  )}
                </p>
              )}
              <ul className="space-y-1">
                {group.modules.map(module => (
                  <li key={module.key}>
                    <SidebarNavItem
                      module={module}
                      basePath={basePath}
                      collapsed={collapsed}
                      adminMark={!isManagement}
                      badge={
                        module.key === 'messenger'
                          ? unread
                          : module.key === 'feed'
                            ? noticesUnread + feedNew
                            : module.key === 'email'
                              ? mailUnread
                              : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 px-3 pb-4 pt-2">
        <SidebarNavItem module={SETTINGS_MODULE} basePath={basePath} collapsed={collapsed} />
        {canToggle && (
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
        )}
      </div>
    </aside>
  );
};
