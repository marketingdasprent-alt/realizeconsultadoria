import React from 'react';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { FILTERS } from '../lib/format';
import type { ConversationFilter } from '../types';

interface MessengerFiltersProps {
  value: ConversationFilter;
  onChange: (value: ConversationFilter) => void;
  /** Não lidas por tipo (pontinho no mosaico). */
  unreadByFilter: Partial<Record<ConversationFilter, number>>;
}

/** Coluna de navegação do Messenger: tipos de conversa em mosaicos coloridos. */
export const MessengerFilters: React.FC<MessengerFiltersProps> = ({
  value,
  onChange,
  unreadByFilter,
}) => (
  <nav
    aria-label="Tipos de conversa"
    className="scrollbar-hide hidden w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-rz-line bg-white/60 py-3 lg:flex"
  >
    {FILTERS.map(filter => {
      const isActive = value === filter.key;
      const unread = unreadByFilter[filter.key] ?? 0;
      return (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange(filter.key)}
          aria-pressed={isActive}
          className={cn(
            'relative flex w-[72px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-[11px] font-semibold transition-all',
            isActive
              ? 'bg-rz-primary-soft text-rz-primary shadow-[inset_0_0_0_1px_hsl(var(--rz-primary)/0.18)]'
              : 'text-rz-muted hover:bg-rz-canvas hover:text-rz-ink'
          )}
        >
          <ModuleIcon
            module={filter}
            size="md"
            className={cn('transition-transform', isActive ? 'scale-105' : 'opacity-90')}
          />
          <span className="max-w-full truncate">{filter.label}</span>
          {unread > 0 && (
            <span className="absolute right-2 top-1.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
              {unread}
            </span>
          )}
        </button>
      );
    })}
  </nav>
);
