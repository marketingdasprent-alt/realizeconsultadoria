import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { absenceTypeLabels } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import {
  STATUS_FILTERS,
  type RequestFilters,
  type RequestStatusFilter,
} from '../../lib/absenceRequests';

interface RequestsFiltersProps {
  filters: RequestFilters;
  counts: Record<RequestStatusFilter, number>;
  companies: { id: string; name: string }[];
  onChange: (patch: Partial<RequestFilters>) => void;
}

const SELECT = 'h-9 w-full rounded-full border-rz-line bg-white text-[13px] sm:w-[170px]';

/** Estado (com os números de cada um), pesquisa, tipo e empresa. */
export const RequestsFilters: React.FC<RequestsFiltersProps> = ({
  filters,
  counts,
  companies,
  onChange,
}) => (
  <div className="space-y-3 border-b border-rz-line p-3 sm:p-4">
    <div
      role="tablist"
      aria-label="Estado"
      className="flex w-full gap-1 overflow-x-auto rounded-full bg-rz-canvas p-1 ring-1 ring-rz-line sm:w-fit"
    >
      {STATUS_FILTERS.map(option => {
        const active = filters.status === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange({ status: option.value })}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              active ? 'bg-white text-rz-ink shadow-sm' : 'text-rz-muted hover:text-rz-ink'
            )}
          >
            {option.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[11.5px] font-bold',
                option.value === 'pending' && counts.pending > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rz-line/60 text-rz-muted'
              )}
            >
              {counts[option.value]}
            </span>
          </button>
        );
      })}
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
        <Input
          type="search"
          autoComplete="off"
          spellCheck={false}
          name="search-absences"
          placeholder="Pesquisar colaborador…"
          value={filters.search}
          onChange={event => onChange({ search: event.target.value })}
          className="h-9 rounded-full border-rz-line pl-9 text-[13px]"
        />
      </div>
      <Select value={filters.type} onValueChange={type => onChange({ type })}>
        <SelectTrigger className={SELECT} aria-label="Tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {Object.entries(absenceTypeLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {companies.length > 1 && (
        <Select value={filters.companyId} onValueChange={companyId => onChange({ companyId })}>
          <SelectTrigger className={SELECT} aria-label="Empresa">
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
      )}
    </div>
  </div>
);
