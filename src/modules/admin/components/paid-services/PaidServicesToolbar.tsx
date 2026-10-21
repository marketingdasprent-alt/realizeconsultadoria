import React from 'react';
import { Globe, Plus, Repeat, Search, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PaidFilters, PaidKind } from '../../lib/paidServices';

const KINDS: { value: PaidFilters['kind']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'domain', label: 'Domínios' },
  { value: 'internet', label: 'Internet' },
  { value: 'subscription', label: 'Assinaturas' },
];

const ADD: { kind: PaidKind; label: string; icon: typeof Globe }[] = [
  { kind: 'domain', label: 'Domínio', icon: Globe },
  { kind: 'internet', label: 'Internet', icon: Wifi },
  { kind: 'subscription', label: 'Assinatura', icon: Repeat },
];

interface PaidServicesToolbarProps {
  filters: PaidFilters;
  companies: { id: string; name: string }[];
  canManage: boolean;
  onChange: (patch: Partial<PaidFilters>) => void;
  onAdd: (kind: PaidKind) => void;
}

/** Tipo, pesquisa, empresa e Adicionar — numa linha (parte em duas em ecrãs pequenos). */
export const PaidServicesToolbar: React.FC<PaidServicesToolbarProps> = ({
  filters,
  companies,
  canManage,
  onChange,
  onAdd,
}) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-rz-line p-3 sm:p-4">
    <div className="flex gap-1 rounded-full bg-rz-canvas p-1 ring-1 ring-rz-line" role="tablist">
      {KINDS.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={filters.kind === option.value}
          onClick={() => onChange({ kind: option.value })}
          className={cn(
            'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
            filters.kind === option.value
              ? 'bg-white text-rz-ink shadow-sm'
              : 'text-rz-muted hover:text-rz-ink'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
    <div className="relative min-w-[180px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
      <input
        type="search"
        placeholder="Pesquisar…"
        value={filters.search}
        onChange={event => onChange({ search: event.target.value })}
        className="h-9 w-full rounded-full bg-white pl-9 pr-3 text-[13px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary"
      />
    </div>
    <Select value={filters.companyId} onValueChange={companyId => onChange({ companyId })}>
      <SelectTrigger
        className="h-9 w-[190px] rounded-full border-rz-line text-[13px]"
        aria-label="Empresa"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as empresas</SelectItem>
        {companies.map(company => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {canManage && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="gold" size="sm" className="h-9 rounded-full px-4">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ADD.map(({ kind, label, icon: Icon }) => (
            <DropdownMenuItem key={kind} onClick={() => onAdd(kind)}>
              <Icon className="mr-2 h-4 w-4" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);
