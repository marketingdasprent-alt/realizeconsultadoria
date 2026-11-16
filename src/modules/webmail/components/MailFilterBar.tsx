import React from 'react';
import { cn } from '@/lib/utils';
import { LIST_FILTERS, isFiltering, type ListFilter, type ListFilterKey } from '../lib/listFilter';

interface MailFilterBarProps {
  filter: ListFilter;
  onToggle: (key: ListFilterKey) => void;
  onClear: () => void;
  /** Filtros que não se podem ligar aqui (ex.: "Lidos" na pasta "Não lidos"). */
  disabled?: readonly ListFilterKey[];
}

const CHIP =
  'inline-flex h-8 shrink-0 items-center rounded-full px-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40';

/**
 * Filtros da lista, como no Gmail: Todos, Não lidos, Com estrela, Com anexos. "Todos" limpa;
 * os outros ligam-se e desligam-se e combinam-se entre si. Os botões têm texto curto para caberem
 * inteiros na lista estreita (a partir de 340 px); se mesmo assim faltar espaço, a linha rola na
 * horizontal com margem no fim, para o último botão aparecer inteiro.
 */
export const MailFilterBar: React.FC<MailFilterBarProps> = ({
  filter,
  onToggle,
  onClear,
  disabled = [],
}) => {
  const filtering = isFiltering(filter);
  return (
    <div
      role="group"
      aria-label="Filtrar emails"
      className="rz-scroll -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            disabled={disabled.includes(item.key)}
            aria-pressed={on}
            aria-label={item.label}
            title={
              disabled.includes(item.key)
                ? `${item.label}: esta pasta já é só de não lidos`
                : item.label
            }
            className={cn(
              CHIP,
              on ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted hover:text-rz-ink',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-rz-muted'
            )}
          >
            {item.short}
          </button>
        );
      })}
    </div>
  );
};
