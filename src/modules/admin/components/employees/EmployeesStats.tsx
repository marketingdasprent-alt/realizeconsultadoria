import React from 'react';
import { Cake, FileClock, UserCheck, UserRoundX, UserX, type LucideIcon } from 'lucide-react';
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
  /** Documentos enviados pelos colaboradores à espera de aprovação. */
  pendingDocuments: number;
  onPendingDocuments: () => void;
  /** Ativos que nunca entraram na app ou não entram há 7+ dias. */
  notUsing: number;
  onlyNotUsing: boolean;
  onNotUsingChange: (value: boolean) => void;
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
      'flex min-w-0 items-center gap-2.5 rounded-[22px] bg-white p-3 text-left shadow-rz-soft ring-1 transition-all hover:-translate-y-0.5 sm:p-3.5',
      selected ? 'ring-2 ring-rz-primary' : 'ring-rz-line'
    )}
  >
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', tone)}>
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0">
      <span className="block text-[24px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-1 block text-[12px] font-semibold leading-tight text-rz-muted">
        {label}
      </span>
    </span>
  </button>
);

/**
 * Números da equipa: ativos, inativos e aniversários do mês filtram a lista; os documentos
 * por aprovar abrem a fila de aprovação.
 */
export const EmployeesStats: React.FC<EmployeesStatsProps> = ({
  active,
  inactive,
  birthdays,
  status,
  onlyBirthdays,
  onStatusChange,
  onBirthdaysChange,
  pendingDocuments,
  onPendingDocuments,
  notUsing,
  onlyNotUsing,
  onNotUsingChange,
}) => (
  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
    <Tile
      icon={UserCheck}
      tone="bg-emerald-100 text-emerald-700"
      label="Ativos"
      value={active}
      selected={status === 'active' && !onlyBirthdays && !onlyNotUsing}
      onClick={() => {
        onBirthdaysChange(false);
        onNotUsingChange(false);
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
    <Tile
      icon={UserRoundX}
      tone={notUsing > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}
      label="Não entram na app (7+ dias)"
      value={notUsing}
      selected={onlyNotUsing}
      onClick={() => onNotUsingChange(!onlyNotUsing)}
    />
    <Tile
      icon={FileClock}
      tone={pendingDocuments > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}
      label="Documentos por aprovar"
      value={pendingDocuments}
      selected={false}
      onClick={onPendingDocuments}
    />
  </div>
);
