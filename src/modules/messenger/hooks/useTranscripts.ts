import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { transcriptService } from '../services/transcriptService';

const key = (conversationId: string) => ['chat', 'transcripts', conversationId] as const;

type Transcripts = Record<string, string>;

/**
 * Texto das mensagens de voz de uma conversa (já transcritas por alguém) e a ação de transcrever.
 * Todas as mensagens de voz da conversa partilham o mesmo pedido.
 */
export const useTranscripts = (conversationId: string, enabled: boolean) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key(conversationId),
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Transcripts> => {
      const { data, error } = await transcriptService.list(conversationId);
      if (error || !data) throw new Error(error ?? '');
      return Object.fromEntries(data.map(row => [row.message_id, row.text]));
    },
  });

  const transcribe = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await transcriptService.transcribe(messageId);
      if (error || !data) throw new Error(error ?? '');
      return { messageId, text: data.text };
    },
    onSuccess: ({ messageId, text }) =>
      qc.setQueryData<Transcripts>(key(conversationId), current => ({
        ...(current ?? {}),
        [messageId]: text,
      })),
    onError: (error: Error) =>
      toast({
        title: 'Não foi possível transcrever',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return { transcripts: query.data ?? {}, isLoading: query.isLoading, transcribe };
};
