import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { useWorkspace } from '../../context/workspaceContext';
import { MOBILE_TABS, getModule, modulePath } from '../../lib/navigation';
import { MobileMenuSheet } from './MobileMenuSheet';

const TAB =
  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors';

/** Barra inferior no telemóvel: Mensagens, Ponto, Férias, Documentos e Menu. */
export const MobileTabBar: React.FC = () => {
  const { basePath } = useWorkspace();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const unread = useOptionalMessenger()?.unreadTotal ?? 0;

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-[26px] bg-white/95 shadow-rz-pop ring-1 ring-black/5 backdrop-blur md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {MOBILE_TABS.map(key => {
            const module = getModule(key);
            const Icon = module.icon;
            return (
              <li key={key}>
                <NavLink
                  to={modulePath(basePath, module)}
                  end={module.path === ''}
                  className={({ isActive }) =>
                    cn(TAB, isActive ? 'text-rz-primary' : 'text-rz-muted')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'relative flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                          isActive && 'bg-rz-primary-soft'
                        )}
                      >
                        <Icon className={cn('h-[21px] w-[21px]', isActive && 'stroke-[2.4]')} />
                        {key === 'messenger' && unread > 0 && (
                          <span className="absolute -right-0.5 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </span>
                      <span className="max-w-full truncate text-[10.5px]">
                        {key === 'absences' ? 'Férias' : module.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className={cn(TAB, 'w-full text-rz-muted')}
            >
              <span className="flex h-8 w-12 items-center justify-center rounded-full">
                <LayoutGrid className="h-[21px] w-[21px]" />
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>
      <MobileMenuSheet open={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </>
  );
};
