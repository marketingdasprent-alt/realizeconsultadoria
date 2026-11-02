import { useEffect, useRef } from 'react';
import { messengerService, type MessageRow } from '../services/messengerService';

/** Com a conversa aberta e visível, de quanto em quanto tempo confirmar se há mensagens novas. */
const POLL_MS = 4000;

/**
 * Rede de segurança do tempo real: o canal pode deixar de entregar sem dar erro (websocket
 * suspenso pelo navegador, rede móvel), e aí as respostas só apareciam ao recarregar. Com a
 * conversa aberta e o ecrã visível, vai buscar as últimas mensagens de poucos em poucos
 * segundos; quem recebe decide o que é novo ou mudou.
 */
export const useThreadPoll = (
  conversationId: string | null,
  onRows: (rows: MessageRow[]) => void
): void => {
  const onRowsRef = useRef(onRows);
  onRowsRef.current = onRows;

  useEffect(() => {
    if (!conversationId) return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      const { data, error } = await messengerService.listMessages(conversationId);
      busy = false;
      if (!error && data.length) onRowsRef.current(data);
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId]);
};
