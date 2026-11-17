import React from 'react';
import { CompanySelect } from '@/components/admin/CompanySelect';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusFilter = 'active' | 'inactive' | 'all';

interface EmployeesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  companies: { id: string; name: string }[];
  companyId: string;
  onCompanyChange: (companyId: string) => void;
  count: number;
}

const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="flex shrink-0 rounded-full bg-rz-canvas p-1">
    {options.map(option => (
      <button
        key={option.key}
        type="button"
        onClick={() => onChange(option.key)}
        className={cn(
          'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
          value === option.key ? 'bg-rz-ink text-white' : 'text-rz-muted hover:text-rz-ink'
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** Pesquisa, empresa e estado da lista de colaboradores. */
export const EmployeesToolbar: React.FC<EmployeesToolbarProps> = props => (
  <div className="space-y-3 border-b border-rz-line p-3 sm:p-4">
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-rz-canvas px-4 text-rz-muted ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
        <Search className="h-4 w-4 shrink-0" />
        <input
          type="search"
          name="search-employees"
          autoComplete="off"
          spellCheck={false}
          value={props.search}
          onChange={event => props.onSearchChange(event.target.value)}
          placeholder="Procurar por nome, email ou empresa"
          className="w-full bg-transparent text-[14px] text-rz-ink outline-none placeholder:text-rz-muted"
        />
      </label>
      <CompanySelect
        companies={props.companies}
        value={props.companyId}
        onChange={props.onCompanyChange}
        allLabel="Todas as empresas"
        aria-label="Empresa"
        className="h-10 rounded-full sm:w-[230px]"
      />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        value={props.status}
        onChange={props.onStatusChange}
        options={[
          { key: 'active', label: 'Ativos' },
          { key: 'inactive', label: 'Inativos' },
          { key: 'all', label: 'Todos' },
        ]}
      />
      <span className="px-1 text-[13px] font-semibold text-rz-muted">
        {props.count} {props.count === 1 ? 'colaborador' : 'colaboradores'}
      </span>
    </div>
  </div>
);
