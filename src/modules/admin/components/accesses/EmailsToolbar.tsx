import React from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CredentialCompany, MailboxState } from '../../lib/credentials';
import type { EmailFilters } from '../../lib/emailRows';

const STATES: { value: EmailFilters['state']; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'linked', label: 'Ligadas' },
  { value: 'error', label: 'Com erro' },
  { value: 'pending', label: 'Por ligar' },
  { value: 'nobody', label: 'Sem pessoas' },
];

interface EmailsToolbarProps {
  filters: EmailFilters;
  counts: Record<MailboxState, number>;
  companies: CredentialCompany[];
  canManage: boolean;
  bulk: { running: boolean; done: number; total: number };
  onChange: (patch: Partial<EmailFilters>) => void;
  onLinkAll: () => void;
  onNew: () => void;
}

/** Estado (com números), pesquisa, empresa, tipo e ações da aba Emails. */
export const EmailsToolbar: React.FC<EmailsToolbarProps> = ({
  filters,
  counts,
  companies,
  canManage,
  bulk,
  onChange,
  onLinkAll,
  onNew,
}) => (
  <div className="space-y-3 border-b border-rz-line p-3 sm:p-4">
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex gap-1 overflow-x-auto rounded-full bg-rz-canvas p-1 ring-1 ring-rz-line"
        role="tablist"
      >
        {STATES.map(option => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filters.state === option.value}
            onClick={() => onChange({ state: option.value })}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold',
              filters.state === option.value
                ? 'bg-white text-rz-ink shadow-sm'
                : 'text-rz-muted hover:text-rz-ink'
            )}
          >
            {option.label}
            {option.value !== 'all' && (
              <span className="rounded-full bg-rz-line/60 px-1.5 text-[11.5px]">
                {counts[option.value]}
              </span>
            )}
          </button>
        ))}
      </div>
      {canManage && (
        <span className="ml-auto flex gap-2">
          {counts.pending > 0 && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onLinkAll}
              disabled={bulk.running}
            >
              {bulk.running && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulk.running
                ? `A ligar ${bulk.done}/${bulk.total}…`
                : `Ligar as ${counts.pending} por ligar`}
            </Button>
          )}
          <Button variant="gold" className="rounded-full" onClick={onNew}>
            <Plus className="h-4 w-4" /> Novo email
          </Button>
        </span>
      )}
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
        <Input
          type="search"
          placeholder="Pesquisar endereço ou pessoa…"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          className="h-9 rounded-full border-rz-line pl-9 text-[13px]"
        />
      </div>
      <Select
        value={filters.type}
        onValueChange={type => onChange({ type: type as EmailFilters['type'] })}
      >
        <SelectTrigger
          className="h-9 rounded-full border-rz-line text-[13px] sm:w-[170px]"
          aria-label="Tipo"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Pessoais e departamentais</SelectItem>
          <SelectItem value="personal">Só pessoais</SelectItem>
          <SelectItem value="department">Só departamentais</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.companyId} onValueChange={companyId => onChange({ companyId })}>
        <SelectTrigger
          className="h-9 rounded-full border-rz-line text-[13px] sm:w-[200px]"
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
    </div>
  </div>
);
