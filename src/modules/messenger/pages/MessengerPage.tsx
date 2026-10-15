import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationList } from '../components/ConversationList';
import { ConversationView } from '../components/ConversationView';
import { MessengerEmptyState } from '../components/MessengerEmptyState';
import { MessengerFilters } from '../components/MessengerFilters';
import { NewConversationDialog } from '../components/NewConversationDialog';
import { useMessengerApi } from '../context/useMessengerApi';
import type { ConversationFilter } from '../types';

/**
 * Página inicial do Realize 2.0 (briefing §2 e §5): filtros, conversas e a conversa
 * aberta. A conversa aberta fica no endereço (?c=id); no telemóvel mostra a lista ou a
 * conversa, uma de cada vez.
 */
const MessengerPage: React.FC = () => {
  const api = useMessengerApi();
  const { setActive } = api;
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const activeId = params.get('c');
  const active = api.conversations.find(c => c.id === activeId) ?? null;

  // O endereço manda: abrir/fechar uma conversa (também ao sair da página).
  useEffect(() => {
    setActive(activeId);
  }, [activeId, setActive]);
  useEffect(() => () => setActive(null), [setActive]);

  const unreadByFilter = useMemo(() => {
    const counts: Partial<Record<ConversationFilter, number>> = {};
    for (const c of api.conversations) {
      if (c.unread === 0 || c.archived) continue;
      counts.all = (counts.all ?? 0) + 1;
      counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    }
    return counts;
  }, [api.conversations]);

  const open = (id: string) => setParams({ c: id });

  if (api.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-rz-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <MessengerFilters value={filter} onChange={setFilter} unreadByFilter={unreadByFilter} />
      <ConversationList
        conversations={api.conversations}
        filter={filter}
        onFilterChange={setFilter}
        activeId={activeId}
        onSelect={open}
        onNewConversation={() => setIsNewOpen(true)}
        className={cn(
          'w-full border-r border-rz-line md:w-[320px] xl:w-[360px]',
          active && 'hidden md:flex'
        )}
      />
      <div className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <ConversationView conversation={active} onBack={() => setParams({})} />
        ) : (
          <MessengerEmptyState
            onNewConversation={() => setIsNewOpen(true)}
            notice={api.error ?? undefined}
          />
        )}
      </div>
      <NewConversationDialog open={isNewOpen} onOpenChange={setIsNewOpen} onOpened={open} />
    </div>
  );
};

export default MessengerPage;
