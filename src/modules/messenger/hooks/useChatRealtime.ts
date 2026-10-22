import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { retryDelayMs } from '@/lib/retry';
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
  /**
   * O tempo real esteve em baixo (ecrã bloqueado, rede, servidor lento) ou a app voltou ao
   * ecrã: o que chegou entretanto não vem pelo canal (não há repetição), tem de se ir buscar.
   */
  onResync: () => void;
}

/** Ao voltar ao ecrã, no máximo uma ida à BD por este intervalo. */
const RESYNC_GAP_MS = 15_000;

/**
 * Alterações da BD em tempo real para o utilizador: mensagens e participações das
 * conversas onde é membro (o Realtime aplica as mesmas regras de acesso da BD).
 *
 * O canal pode morrer sem aviso (o servidor fecha-o com a BD lenta, o telemóvel suspende o
 * websocket): volta a ligar-se sozinho com espera crescente e, sempre que fica outra vez
 * ligado ou a app volta a estar visível, pede o que se perdeu (onResync).
 */
export const useChatRealtime = (userId: string | null, handlers: ChatRealtimeHandlers): void => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!userId) return;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let wasConnected = false;
    let lostSinceConnected = false;
    let lastResync = 0;
    let stopped = false;

    const resync = (force = false) => {
      const now = Date.now();
      if (!force && now - lastResync < RESYNC_GAP_MS) return;
      lastResync = now;
      handlersRef.current.onResync();
    };

    const scheduleReconnect = () => {
      if (stopped || retryTimer) return;
      lostSinceConnected = true;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connect();
      }, retryDelayMs(attempt));
      attempt += 1;
    };

    const connect = async () => {
      if (stopped) return;
      // O cliente reutiliza o canal com o mesmo nome: o antigo tem de sair primeiro.
      const old = channel;
      channel = null;
      if (old) await supabase.removeChannel(old);
      if (stopped) return;
      const current = supabase
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
        .subscribe(status => {
          // Avisos do canal antigo (ao ser removido) não contam.
          if (stopped || channel !== current) return;
          if (status === 'SUBSCRIBED') {
            attempt = 0;
            // Ligado outra vez depois de uma queda: buscar o que passou entretanto.
            if (wasConnected && lostSinceConnected) resync(true);
            wasConnected = true;
            lostSinceConnected = false;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleReconnect();
          }
        });
      channel = current;
    };

    // Voltar ao ecrã (ou à rede): o websocket pode ter estado suspenso sem dar erro.
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      resync();
      if (channel?.state !== 'joined' && channel?.state !== 'joining') scheduleReconnect();
    };

    void connect();
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('online', onBack);
    window.addEventListener('pageshow', onBack);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('online', onBack);
      window.removeEventListener('pageshow', onBack);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);
};
