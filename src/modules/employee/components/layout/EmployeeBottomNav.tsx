import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, Clock, FolderOpen, Home, Menu } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

const ITEMS = [
  { to: ROUTES.EMPLOYEE.DASHBOARD, label: 'Início', icon: Home, end: true },
  { to: ROUTES.EMPLOYEE.TIMECLOCK, label: 'Ponto', icon: Clock, end: false },
  { to: ROUTES.EMPLOYEE.REQUESTS, label: 'Pedidos', icon: CalendarDays, end: false },
  { to: ROUTES.EMPLOYEE.DOCUMENTS, label: 'Documentos', icon: FolderOpen, end: false },
  { to: ROUTES.EMPLOYEE.MORE, label: 'Mais', icon: Menu, end: false },
];

/**
 * Navegação principal do portal do colaborador: barra fixa em baixo no
 * telemóvel (com margem para o indicador do iPhone) e barra horizontal no topo
 * do conteúdo em ecrãs grandes.
 */
export const EmployeeBottomNav: React.FC = () => (
  <nav
    aria-label="Navegação principal"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:static lg:border-b lg:border-t-0 lg:pb-0"
  >
    <ul className="mx-auto grid max-w-3xl grid-cols-5 lg:flex lg:justify-center lg:gap-2">
      {ITEMS.map(item => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors lg:h-12 lg:flex-row lg:gap-2 lg:px-4 lg:text-sm ${
                isActive ? 'text-gold' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`h-6 w-6 lg:h-5 lg:w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);
