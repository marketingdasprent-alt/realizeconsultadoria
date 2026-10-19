import React, { useMemo, useState } from 'react';
import { matchesText } from '@/lib/text';
import { Link } from 'react-router-dom';
import { MessageSquarePlus, Search, Sparkles, SquarePen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PushPrompt } from '@/modules/workspace/components/PushPrompt';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { FILTERS } from '../lib/format';
import type { ConversationFilter, ConversationSummary } from '../types';
import { ConversationRow } from './ConversationRow';

interface ConversationListProps {
  conversations: ConversationSummary[];
  filter: ConversationFilter;
  onFilterChange: (value: ConversationFilter) => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  className?: string;
}

const CHIP = 'shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors';

/** Coluna de conversas: pesquisa, Todas/Não lidas e a lista (fixadas primeiro). */
export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  filter,
  onFilterChange,
  activeId,
  onSelect,
  onNewConversation,
  className,
}) => {
  const { basePath } = useWorkspace();
  const [query, setQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = conversations.filter(c => c.archived).length;

  const visible = useMemo(() => {
    const term = query;
    return conversations
      .filter(c => (showArchived ? c.archived : !c.archived))
      .filter(c => filter === 'all' || c.kind === filter)
      .filter(c => !onlyUnread || c.unread > 0)
      .filter(c => matchesText(term, c.title, c.lastMessage))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.lastAt.localeCompare(a.lastAt));
  }, [conversations, filter, onlyUnread, query, showArchived]);

  const unreadTotal = conversations.filter(c => c.unread > 0 && !c.archived).length;

  return (
    <section className={cn('flex min-h-0 flex-col bg-white', className)} aria-label="Conversas">
      <div className="space-y-3 px-4 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold">Mensagens</h1>
          <button
            type="button"
            onClick={onNewConversation}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rz-primary text-white shadow-[0_8px_20px_-8px_hsl(var(--rz-primary))] transition-transform hover:scale-105"
            aria-label="Nova conversa"
          >
            <SquarePen className="h-[18px] w-[18px]" />
          </button>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-2xl bg-rz-canvas px-3 text-rz-muted ring-1 ring-transparent focus-within:bg-white focus-within:ring-rz-primary/40">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Procurar colaborador ou conversa"
            className="w-full bg-transparent text-sm text-rz-ink outline-none placeholder:text-rz-muted"
          />
        </label>
        <PushPrompt />
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            type="button"
            onClick={() => setOnlyUnread(false)}
            className={cn(
              CHIP,
              !onlyUnread ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
            )}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setOnlyUnread(true)}
            className={cn(CHIP, onlyUnread ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted')}
          >
            Não lidas{unreadTotal > 0 && <span className="ml-1 opacity-70">{unreadTotal}</span>}
          </button>
          {(archivedCount > 0 || showArchived) && (
            <button
              type="button"
              onClick={() => setShowArchived(value => !value)}
              className={cn(
                CHIP,
                showArchived ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
              )}
            >
              Arquivadas<span className="ml-1 opacity-70">{archivedCount}</span>
            </button>
          )}
          {/* Sem a coluna de filtros (ecrãs pequenos), os tipos aparecem como chips. */}
          {FILTERS.slice(1).map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(filter === option.key ? 'all' : option.key)}
              className={cn(
                CHIP,
                'lg:hidden',
                filter === option.key
                  ? 'bg-rz-primary-soft text-rz-primary'
                  : 'bg-rz-canvas text-rz-muted'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rz-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-28 md:pb-3">
        {/* O Realize AI fica sempre à mão no topo (abre o assistente, numa página própria). */}
        {!showArchived && !conversations.some(c => c.kind === 'ai') && (
          <Link
            to={`${basePath}/ai`}
            className="mb-1 flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-rz-canvas"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold">Realize AI</span>
              <span className="block truncate text-[13px] text-rz-muted">
                Pergunte ou peça para marcar, criar e lembrar
              </span>
            </span>
          </Link>
        )}
        {visible.length > 0 ? (
          <ul className="space-y-0.5">
            {visible.map(conversation => (
              <li key={conversation.id}>
                <ConversationRow
                  conversation={conversation}
                  isActive={conversation.id === activeId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] bg-rz-primary-soft">
              <MessageSquarePlus className="h-6 w-6 text-rz-primary" />
            </span>
            <p className="font-semibold">
              {conversations.length === 0 ? 'Ainda não há conversas' : 'Nada encontrado'}
            </p>
            <p className="mt-1 text-sm text-rz-muted">
              {conversations.length === 0
                ? 'Comece uma conversa com um colega.'
                : 'Experimente outro nome ou filtro.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
