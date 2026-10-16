import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, ChevronRight, ClipboardList, UserPlus } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';

const SHORTCUTS = [
  {
    label: 'Registar colaborador',
    href: ROUTES.ADMIN.EMPLOYEE_NEW,
    icon: UserPlus,
    tint: 'from-fuchsia-400 to-purple-600',
  },
  {
    label: 'Pedidos por aprovar',
    href: `${ROUTES.ADMIN.REQUESTS}?status=pending`,
    icon: ClipboardList,
    tint: 'from-lime-400 to-green-600',
  },
  {
    label: 'Calendário geral',
    href: ROUTES.ADMIN.CALENDAR,
    icon: CalendarDays,
    tint: 'from-rose-400 to-red-500',
  },
  {
    label: 'Empresas',
    href: ROUTES.ADMIN.COMPANIES,
    icon: Building2,
    tint: 'from-sky-400 to-blue-600',
  },
];

/** Atalhos para o que os RH fazem mais vezes. */
export const DashboardShortcuts: React.FC = () => (
  <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line sm:p-6">
    <h2 className="text-[17px] font-extrabold">Atalhos</h2>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {SHORTCUTS.map(shortcut => (
        <li key={shortcut.label}>
          <Link
            to={shortcut.href}
            className="group flex items-center gap-3 rounded-2xl bg-rz-canvas p-3 transition-colors hover:bg-rz-primary-soft"
          >
            <ModuleIcon module={shortcut} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              {shortcut.label}
            </span>
            <ChevronRight className="h-4 w-4 text-rz-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
