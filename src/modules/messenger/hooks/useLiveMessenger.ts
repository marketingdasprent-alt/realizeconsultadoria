// Messenger com servidor real (Supabase): conversas, mensagens, presença e tempo real.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { CHAT_KEYS, upsertThreadRow } from '../lib/cache';
import { toConversation, toMessage, toPerson } from '../lib/mappers';
import {
  messengerService,
  PAGE_SIZE,
  type ConversationRow,
  type MessageRow,
} from '../services/messengerService';
import type { ChatMessage, MessengerApi } from '../types';
import { useChatRealtime } from './useChatRealtime';
import { useConversationChannel } from './useConversationChannel';
import { useMessengerActions } from './useMessengerActions';
import { usePresence } from './usePresence';

export interface LiveMessengerUser {
  userId: string;
  companyId: string;
  name: string;
}

const unwrap = async <T>(promise: Promise<{ data: T; error: unknown }>): Promise<T> => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

export const useLiveMessenger = (user: LiveMessengerUser): MessengerApi => {
  const qc = useQueryClient();
  const [activeId, setActive] = useState<string | null>(null);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const online = usePresence(user.companyId, user.userId);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const boot = useQuery({
    queryKey: CHAT_KEYS.boot,
    queryFn: async () => {
      const { error } = await messengerService.bootstrap();
      if (error) throw error;
      return true;
    },
    staleTime: Infinity,
  });
  const conversationsQ = useQuery({
    queryKey: CHAT_KEYS.conversations,
    queryFn: () => unwrap(messengerService.listConversations()),
    enabled: boot.isSuccess,
  });
  const directoryQ = useQuery({
    queryKey: CHAT_KEYS.directory,
    queryFn: () => unwrap(messengerService.getDirectory()),
    staleTime: 5 * 60_000,
  });
  const thread = useInfiniteQuery({
    queryKey: CHAT_KEYS.thread(activeId),
    queryFn: ({ pageParam }) =>
      unwrap(messengerService.listMessages(activeId as string, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last =>
      last.length === PAGE_SIZE ? last[last.length - 1].created_at : undefined,
    enabled: !!activeId,
  });
  const membersQ = useQuery({
    queryKey: CHAT_KEYS.members(activeId),
    queryFn: () => unwrap(messengerService.listMembers(activeId as string)),
    enabled: !!activeId,
  });
  const reactionsQ = useQuery({
    queryKey: CHAT_KEYS.reactions(activeId),
    queryFn: () => unwrap(messengerService.listReactions(activeId as string)),
    enabled: !!activeId,
  });

  const refreshList = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => qc.invalidateQueries({ queryKey: CHAT_KEYS.conversations }),
      350
    );
  }, [qc]);

  const markRead = useCallback(
    async (conversationId: string) => {
      await messengerService.markRead(conversationId);
      qc.setQueryData(CHAT_KEYS.conversations, (rows: ConversationRow[] | undefined) =>
        rows?.map(r => (r.id === conversationId ? { ...r, unread: 0 } : r))
      );
    },
    [qc]
  );

  useChatRealtime(user.userId, {
    onMessage: (row, event) => {
      qc.setQueryData(CHAT_KEYS.thread(row.conversation_id), (data: InfiniteData<MessageRow[]>) =>
        upsertThreadRow(data, row)
      );
      const seenNow = row.conversation_id === activeId && document.visibilityState === 'visible';
      if (event === 'INSERT' && seenNow && row.sender_id !== user.userId) {
        markRead(row.conversation_id);
      }
      refreshList();
    },
    onMembership: ({ conversationId, userId, event }) => {
      if (conversationId === activeId) {
        qc.invalidateQueries({ queryKey: CHAT_KEYS.members(conversationId) });
      }
      // Um colega a ler (UPDATE de outro membro) só mexe nos vistos da conversa aberta.
      if (event === 'UPDATE' && userId && userId !== user.userId) return;
      refreshList();
    },
    onSettings: refreshList,
  });

  const channel = useConversationChannel(activeId, user.userId, () =>
    qc.invalidateQueries({ queryKey: CHAT_KEYS.reactions(activeId) })
  );

  // Abrir uma conversa (ou voltar à app com ela aberta) marca-a como lida.
  useEffect(() => {
    if (!activeId) return;
    markRead(activeId);
    const onVisible = () => document.visibilityState === 'visible' && markRead(activeId);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeId, markRead]);

  const names = useMemo(
    () => new Map((directoryQ.data ?? []).map(p => [p.user_id, p.name])),
    [directoryQ.data]
  );
  const conversations = useMemo(
    () => (conversationsQ.data ?? []).map(row => toConversation(row, user.userId, online)),
    [conversationsQ.data, user.userId, online]
  );
  const active = conversations.find(c => c.id === activeId);

  const messages = useMemo(() => {
    const rows = (thread.data?.pages.flat() ?? []).slice().reverse();
    const byId = new Map(rows.map(r => [r.id, r]));
    const ctx = {
      myUserId: user.userId,
      names,
      reactions: reactionsQ.data ?? [],
      members: membersQ.data ?? [],
      byId,
      isDirect: active?.kind === 'direct',
    };
    const mine = pending.filter(m => m.conversationId === activeId);
    return [...rows.map(row => toMessage(row, ctx)), ...mine];
  }, [
    thread.data,
    names,
    reactionsQ.data,
    membersQ.data,
    pending,
    activeId,
    active?.kind,
    user.userId,
  ]);

  const actions = useMessengerActions({
    user,
    activeId,
    setActive,
    setPending,
    reactions: reactionsQ.data ?? [],
    notifyReactions: channel.notifyReactions,
    refreshList,
  });

  return {
    isLoading: boot.isLoading || conversationsQ.isLoading,
    error: boot.error || conversationsQ.error ? 'Não foi possível carregar as conversas.' : null,
    me: { userId: user.userId, name: user.name },
    conversations,
    directory: (directoryQ.data ?? []).map(toPerson).filter(p => p.userId !== user.userId),
    isOnline: (userId: string) => online.has(userId),
    // Menu: mensagens por ler, sem as silenciadas nem as arquivadas.
    unreadTotal: conversations.reduce((sum, c) => sum + (c.muted || c.archived ? 0 : c.unread), 0),
    activeId,
    setActive,
    messages,
    messagesLoading: thread.isLoading,
    hasOlder: !!thread.hasNextPage,
    loadOlder: () => thread.fetchNextPage(),
    typing: channel.typingUserIds.map(id => names.get(id)?.split(' ')[0] ?? 'Alguém'),
    notifyTyping: channel.notifyTyping,
    ...actions,
  };
};
