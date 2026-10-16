import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ClipboardList, Headset, Palmtree, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import type { DashboardOverview } from '../services/dashboardService';

interface Tile {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  tint: string;
  value: (data: DashboardOverview) => number;
  /** Destaca o número quando há trabalho por fazer. */
  attention?: boolean;
}

const TILES: Tile[] = [
  {
    label: 'Empresas',
    hint: 'registadas',
    href: ROUTES.ADMIN.COMPANIES,
    icon: Building2,
    tint: 'from-sky-400 to-blue-600',
    value: data => data.totalCompanies,
  },
  {
    label: 'Colaboradores',
    hint: 'ativos',
    href: ROUTES.ADMIN.EMPLOYEES,
    icon: Users,
    tint: 'from-fuchsia-400 to-purple-600',
    value: data => data.totalEmployees,
  },
  {
    label: 'Pedidos pendentes',
    hint: 'férias e ausências por aprovar',
    href: `${ROUTES.ADMIN.REQUESTS}?status=pending`,
    icon: ClipboardList,
    tint: 'from-lime-400 to-green-600',
    value: data => data.pendingAbsences,
    attention: true,
  },
  {
    label: 'Tickets em aberto',
    hint: 'pedidos de suporte',
    href: ROUTES.ADMIN.SUPPORT,
    icon: Headset,
    tint: 'from-cyan-400 to-sky-600',
    value: data => data.openTickets,
    attention: true,
  },
  {
    label: 'Ausentes hoje',
    hint: 'de férias ou ausência',
    href: ROUTES.ADMIN.CALENDAR,
    icon: Palmtree,
    tint: 'from-rose-400 to-red-500',
    value: data => data.absentToday.length,
  },
];

interface DashboardStatsProps {
  data: DashboardOverview | undefined;
}

/** Os números do dia em mosaicos clicáveis (cada um abre a página respetiva). */
export const DashboardStats: React.FC<DashboardStatsProps> = ({ data }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
    {TILES.map(tile => {
      const value = data ? tile.value(data) : null;
      return (
        <Link
          key={tile.label}
          to={tile.href}
          className="group rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line transition-all hover:-translate-y-0.5 hover:ring-rz-primary/30 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <ModuleIcon module={tile} size="md" />
            {tile.attention && !!value && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                Ver
              </span>
            )}
          </div>
          <p
            className={cn(
              'mt-4 text-[32px] font-extrabold leading-none tracking-tight',
              value === null && 'animate-pulse text-rz-line'
            )}
          >
            {value ?? '–'}
          </p>
          <p className="mt-1.5 text-[14px] font-semibold text-rz-ink">{tile.label}</p>
          <p className="text-[12.5px] text-rz-muted">{tile.hint}</p>
        </Link>
      );
    })}
  </div>
);
