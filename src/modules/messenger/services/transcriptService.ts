// Transcrição das mensagens de voz (edge function chat-transcribe): o servidor de voz faz o
// trabalho e o texto fica guardado para todos os membros da conversa.
import { supabase } from '@/integrations/supabase/client';

const UNAVAILABLE = 'Não foi possível transcrever. Tente outra vez.';

const call = async <T>(body: Record<string, unknown>) => {
  try {
    const { data, error } = await supabase.functions.invoke('chat-transcribe', { body });
    if (error || !data) {
      // A função falhou ou não respondeu: o código ajuda a perceber porquê
      const status = (error as { context?: { status?: number } } | null)?.context?.status;
      return {
        data: null as T | null,
        error: status ? `${UNAVAILABLE} (código ${status})` : UNAVAILABLE,
      };
    }
    if (!data.ok) return { data: null as T | null, error: (data.message as string) || UNAVAILABLE };
    return { data: data.data as T, error: null };
  } catch {
    return { data: null as T | null, error: UNAVAILABLE };
  }
};

export const transcriptService = {
  /** Mensagens de voz da conversa que já têm texto. */
  list: (conversationId: string) =>
    call<{ message_id: string; text: string }[]>({
      action: 'list',
      conversation_id: conversationId,
    }),

  /** Transcreve (se ainda não estiver) e devolve o texto. */
  transcribe: (messageId: string) =>
    call<{ text: string }>({ action: 'transcribe', message_id: messageId }),
};
