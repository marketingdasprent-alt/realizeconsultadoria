// Navegação do painel de administração (Realize 2.0): módulos agrupados por função, cada um
// com o mosaico colorido do colaborador. `moduleKey` é a permissão que o mostra.
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileCheck,
  Headset,
  KeyRound,
  LayoutDashboard,
  Scale,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export interface AdminNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  moduleKey: string;
  /** Gradiente do mosaico do ícone (classes Tailwind). */
  tint: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Geral',
    items: [
      {
        href: ROUTES.ADMIN.DASHBOARD,
        icon: LayoutDashboard,
        label: 'Dashboard',
        moduleKey: 'dashboard',
        tint: 'from-violet-500 to-indigo-500',
      },
      {
        href: ROUTES.ADMIN.CALENDAR,
        icon: CalendarDays,
        label: 'Calendário',
        moduleKey: 'calendar',
        tint: 'from-rose-400 to-red-500',
      },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      {
        href: ROUTES.ADMIN.EMPLOYEES,
        icon: Users,
        label: 'Colaboradores',
        moduleKey: 'employees',
        tint: 'from-fuchsia-400 to-purple-600',
      },
      {
        href: ROUTES.ADMIN.DOCUMENTS,
        icon: FileCheck,
        label: 'Documentos',
        moduleKey: 'employees',
        tint: 'from-amber-400 to-orange-500',
      },
      {
        href: ROUTES.ADMIN.REQUESTS,
        icon: ClipboardList,
        label: 'Pedidos',
        moduleKey: 'requests',
        tint: 'from-lime-400 to-green-600',
      },
      {
        href: ROUTES.ADMIN.TIMECLOCK,
        icon: Clock,
        label: 'Ponto',
        moduleKey: 'timeclock',
        tint: 'from-indigo-400 to-blue-600',
      },
    ],
  },
  {
    label: 'Empresa',
    items: [
      {
        href: ROUTES.ADMIN.COMPANIES,
        icon: Building2,
        label: 'Empresas',
        moduleKey: 'companies',
        tint: 'from-sky-400 to-blue-600',
      },
      {
        href: ROUTES.ADMIN.ACCESSES,
        icon: KeyRound,
        label: 'Acessos',
        moduleKey: 'accesses',
        tint: 'from-teal-400 to-cyan-600',
      },
      {
        href: ROUTES.ADMIN.LEGAL,
        icon: Scale,
        label: 'Jurídico',
        moduleKey: 'legal',
        tint: 'from-orange-400 to-rose-500',
      },
    ],
  },
  {
    label: 'Apoio',
    items: [
      {
        href: ROUTES.ADMIN.SUPPORT,
        icon: Headset,
        label: 'Suporte',
        moduleKey: 'support',
        tint: 'from-cyan-400 to-sky-600',
      },
    ],
  },
];

export const ADMIN_SETTINGS_ITEM: AdminNavItem = {
  href: ROUTES.ADMIN.SETTINGS,
  icon: Settings,
  label: 'Configurações',
  moduleKey: 'settings',
  tint: 'from-slate-400 to-slate-600',
};

/** Só os grupos (e módulos) que o admin pode ver; grupos vazios desaparecem. */
export const visibleAdminGroups = (canView: (moduleKey: string) => boolean): AdminNavGroup[] =>
  ADMIN_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => canView(item.moduleKey)),
  })).filter(group => group.items.length > 0);
