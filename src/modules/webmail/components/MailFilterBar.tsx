import React from 'react';
import { cn } from '@/lib/utils';
import { LIST_FILTERS, isFiltering, type ListFilter, type ListFilterKey } from '../lib/listFilter';

interface MailFilterBarProps {
  filter: ListFilter;
  onToggle: (key: ListFilterKey) => void;
  onClear: () => void;
}

const CHIP =
  'inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40';

/**
 * Filtros da lista, como no Gmail: Todos, Não lidos, Com estrela, Com anexos. "Todos" limpa;
 * os outros ligam-se e desligam-se e combinam-se entre si. Em ecrãs estreitos a linha rola na
 * horizontal (os botões não quebram nem tapam a lista).
 */
export const MailFilterBar: React.FC<MailFilterBarProps> = ({ filter, onToggle, onClear }) => {
  const filtering = isFiltering(filter);
  return (
    <div
      role="group"
      aria-label="Filtrar emails"
      className="rz-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onClick={onClear}
        aria-pressed={!filtering}
        className={cn(
          CHIP,
          !filtering ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted hover:text-rz-ink'
        )}
      >
        Todos
      </button>
      {LIST_FILTERS.map(item => {
        const on = filter.has(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={on}
            className={cn(
              CHIP,
              on ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted hover:text-rz-ink'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
