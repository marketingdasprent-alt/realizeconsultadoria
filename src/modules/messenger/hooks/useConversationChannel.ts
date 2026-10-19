import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const TYPING_VISIBLE_MS = 4000;
const TYPING_THROTTLE_MS = 2500;

interface ConversationChannel {
  /** user ids a escrever agora. */
  typingUserIds: string[];
  notifyTyping: () => void;
  /** Avisa os outros membros de que as reações de uma mensagem mudaram. */
  notifyReactions: (messageId: string) => void;
}

/**
 * Canal efémero (broadcast) da conversa aberta: "está a escrever…" e aviso de reações.
 * Nada disto é gravado; as mensagens chegam pelas alterações da BD.
 */
export const useConversationChannel = (
  conversationId: string | null,
  myUserId: string,
  onReactions: (messageId: string) => void
): ConversationChannel => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const onReactionsRef = useRef(onReactions);
  const [typing, setTyping] = useState<Record<string, number>>({});
  onReactionsRef.current = onReactions;

  useEffect(() => {
    setTyping({});
    if (!conversationId) return;
    const channel = supabase.channel(`chat-conv-${conversationId}`, {
      // Privado: só os membros da conversa ouvem e enviam (regras em realtime.messages).
      config: { private: true, broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const userId = (payload as { userId?: string }).userId;
        if (userId && userId !== myUserId) setTyping(t => ({ ...t, [userId]: Date.now() }));
      })
      .on('broadcast', { event: 'reactions' }, ({ payload }) => {
        const messageId = (payload as { messageId?: string }).messageId;
        if (messageId) onReactionsRef.current(messageId);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, myUserId]);

  // Limpa quem deixou de escrever.
  useEffect(() => {
    if (Object.keys(typing).length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping(t =>
        Object.fromEntries(Object.entries(t).filter(([, at]) => now - at < TYPING_VISIBLE_MS))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: myUserId } });
  }, [myUserId]);

  const notifyReactions = useCallback((messageId: string) => {
    channelRef.current?.send({ type: 'broadcast', event: 'reactions', payload: { messageId } });
  }, []);

  return { typingUserIds: Object.keys(typing), notifyTyping, notifyReactions };
};
