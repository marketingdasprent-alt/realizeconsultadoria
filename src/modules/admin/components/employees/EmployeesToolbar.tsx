import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type StatusFilter = 'active' | 'inactive' | 'all';
export type EmployeesView = 'personal' | 'financial';

interface EmployeesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  companies: { id: string; name: string }[];
  companyId: string;
  onCompanyChange: (companyId: string) => void;
  view: EmployeesView;
  onViewChange: (view: EmployeesView) => void;
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

/** Pesquisa, estado, empresa e vista (dados pessoais / financeiros) da lista. */
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
          placeholder={
            props.view === 'financial'
              ? 'Procurar por nome, IBAN ou empresa'
              : 'Procurar por nome, email ou empresa'
          }
          className="w-full bg-transparent text-[14px] text-rz-ink outline-none placeholder:text-rz-muted"
        />
      </label>
      <Select value={props.companyId} onValueChange={props.onCompanyChange}>
        <SelectTrigger className="h-10 w-full rounded-full sm:w-[230px]">
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as empresas</SelectItem>
          {props.companies.map(company => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <div className="ml-auto">
        <Segmented
          value={props.view}
          onChange={props.onViewChange}
          options={[
            { key: 'personal', label: 'Dados pessoais' },
            { key: 'financial', label: 'Financeiro' },
          ]}
        />
      </div>
    </div>
  </div>
);
