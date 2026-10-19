import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MessageRow } from '../services/messengerService';

export interface MembershipChange {
  conversationId: string;
  userId: string | null;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface ChatRealtimeHandlers {
  onMessage: (row: MessageRow, event: 'INSERT' | 'UPDATE') => void;
  /** Participações mudaram (conversa nova, saída, lida por alguém). */
  onMembership: (change: MembershipChange) => void;
  /** As minhas preferências (fixar, silenciar, arquivar) mudaram noutro dispositivo. */
  onSettings: () => void;
}

/**
 * Alterações da BD em tempo real para o utilizador: mensagens e participações das
 * conversas onde é membro (o Realtime aplica as mesmas regras de acesso da BD).
 */
export const useChatRealtime = (userId: string | null, handlers: ChatRealtimeHandlers): void => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat-db-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, p =>
        handlersRef.current.onMessage(p.new as MessageRow, 'INSERT')
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, p =>
        handlersRef.current.onMessage(p.new as MessageRow, 'UPDATE')
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, p => {
        const row = (p.eventType === 'DELETE' ? p.old : p.new) as {
          conversation_id?: string;
          user_id?: string;
        };
        if (!row?.conversation_id) return;
        handlersRef.current.onMembership({
          conversationId: row.conversation_id,
          userId: row.user_id ?? null,
          event: p.eventType,
        });
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_member_settings',
          filter: `user_id=eq.${userId}`,
        },
        () => handlersRef.current.onSettings()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
