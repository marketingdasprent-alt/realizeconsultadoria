import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueueFilter } from '../../lib/supportTickets';
import { RzSelect } from '@/modules/workspace/components/RzSelect';

interface SupportFiltersProps {
  queue: QueueFilter;
  onQueue: (queue: QueueFilter) => void;
  counts: Record<QueueFilter, number>;
  search: string;
  onSearch: (value: string) => void;
  priority: string;
  onPriority: (value: string) => void;
  departmentId: string;
  onDepartment: (value: string) => void;
  departments: { id: string; name: string }[];
}

const QUEUES: { key: QueueFilter; label: string }[] = [
  { key: 'awaiting', label: 'À espera' },
  { key: 'active', label: 'Ativos' },
  { key: 'done', label: 'Resolvidos' },
  { key: 'all', label: 'Todos' },
];

const SELECT =
  'h-9 rounded-full bg-rz-canvas px-3 text-[12.5px] font-semibold text-rz-ink outline-none ring-1 ring-transparent focus:ring-rz-primary/40';

/** Pesquisa, fila (à espera / ativos / resolvidos) e filtros da lista de tickets. */
export const SupportFilters: React.FC<SupportFiltersProps> = props => (
  <div className="space-y-2.5 border-b border-rz-line p-3">
    <label className="flex h-10 items-center gap-2 rounded-full bg-rz-canvas px-4 text-rz-muted ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
      <Search className="h-4 w-4 shrink-0" />
      <input
        type="search"
        value={props.search}
        onChange={event => props.onSearch(event.target.value)}
        placeholder="Procurar por assunto, colaborador, texto…"
        className="w-full bg-transparent text-[13.5px] text-rz-ink outline-none placeholder:text-rz-muted"
      />
    </label>
    <div className="scrollbar-hide flex gap-1 overflow-x-auto">
      {QUEUES.map(queue => (
        <button
          key={queue.key}
          type="button"
          onClick={() => props.onQueue(queue.key)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold',
            props.queue === queue.key
              ? 'bg-rz-ink text-white'
              : 'bg-rz-canvas text-rz-muted hover:text-rz-ink'
          )}
        >
          {queue.label} <span className="opacity-70">{props.counts[queue.key]}</span>
        </button>
      ))}
    </div>
    <div className="flex gap-2">
      <RzSelect
        value={props.priority}
        onChange={props.onPriority}
        ariaLabel="Prioridade"
        className={SELECT}
        options={[
          { value: 'all', label: 'Todas as prioridades' },
          { value: 'urgent', label: 'Urgente', dot: 'bg-red-500' },
          { value: 'high', label: 'Alta', dot: 'bg-orange-500' },
          { value: 'medium', label: 'Média', dot: 'bg-amber-400' },
          { value: 'low', label: 'Baixa', dot: 'bg-slate-400' },
        ]}
      />
      {props.departments.length > 1 && (
        <RzSelect
          value={props.departmentId}
          onChange={props.onDepartment}
          ariaLabel="Departamento"
          className={cn(SELECT, 'min-w-0 flex-1')}
          options={[
            { value: 'all', label: 'Todos os departamentos' },
            ...props.departments.map(dept => ({ value: dept.id, label: dept.name })),
          ]}
        />
      )}
    </div>
  </div>
);
