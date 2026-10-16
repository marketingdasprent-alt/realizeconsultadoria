import React from 'react';
import { Cake, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusFilter } from './EmployeesToolbar';

interface EmployeesStatsProps {
  active: number;
  inactive: number;
  birthdays: number;
  status: StatusFilter;
  onlyBirthdays: boolean;
  onStatusChange: (status: StatusFilter) => void;
  onBirthdaysChange: (value: boolean) => void;
}

interface TileProps {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: number;
  selected: boolean;
  onClick: () => void;
}

const Tile: React.FC<TileProps> = ({ icon: Icon, tone, label, value, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 rounded-[22px] bg-white p-4 text-left shadow-rz-soft ring-1 transition-all hover:-translate-y-0.5',
      selected ? 'ring-2 ring-rz-primary' : 'ring-rz-line'
    )}
  >
    <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone)}>
      <Icon className="h-5 w-5" />
    </span>
    <span>
      <span className="block text-[26px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-1 block text-[13px] font-semibold text-rz-muted">{label}</span>
    </span>
  </button>
);

/** Números da equipa; cada mosaico filtra a lista (ativos, inativos, aniversários do mês). */
export const EmployeesStats: React.FC<EmployeesStatsProps> = ({
  active,
  inactive,
  birthdays,
  status,
  onlyBirthdays,
  onStatusChange,
  onBirthdaysChange,
}) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <Tile
      icon={UserCheck}
      tone="bg-emerald-100 text-emerald-700"
      label="Ativos"
      value={active}
      selected={status === 'active' && !onlyBirthdays}
      onClick={() => {
        onBirthdaysChange(false);
        onStatusChange('active');
      }}
    />
    <Tile
      icon={UserX}
      tone="bg-slate-100 text-slate-600"
      label="Inativos"
      value={inactive}
      selected={status === 'inactive' && !onlyBirthdays}
      onClick={() => {
        onBirthdaysChange(false);
        onStatusChange('inactive');
      }}
    />
    <Tile
      icon={Cake}
      tone="bg-pink-100 text-pink-600"
      label="Fazem anos este mês"
      value={birthdays}
      selected={onlyBirthdays}
      onClick={() => onBirthdaysChange(!onlyBirthdays)}
    />
  </div>
);
