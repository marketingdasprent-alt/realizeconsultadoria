import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supportAdminService } from '../services/supportAdminService';

export const SUPPORT_KEYS = {
  marks: ['admin', 'support', 'reply-marks'] as const,
  replies: (ticketId: string) => ['admin', 'support', 'replies', ticketId] as const,
  attachments: (ticketId: string) => ['admin', 'support', 'attachments', ticketId] as const,
  note: (ticketId: string) => ['admin', 'support', 'note', ticketId] as const,
};

/** Quem falou por último em cada ticket (lista: "à espera de resposta"). */
export const useReplyMarks = () =>
  useQuery({
    queryKey: SUPPORT_KEYS.marks,
    queryFn: async () => {
      const { data, error } = await supportAdminService.replyMarks();
      if (error) throw error;
      return data;
    },
  }).data ?? [];

/** Conversa e anexos do ticket aberto. */
export const useTicketDetail = (ticketId: string | null) => {
  const replies = useQuery({
    queryKey: SUPPORT_KEYS.replies(ticketId ?? ''),
    queryFn: async () => {
      const { data, error } = await supportAdminService.listReplies(ticketId!);
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });
  const attachments = useQuery({
    queryKey: SUPPORT_KEYS.attachments(ticketId ?? ''),
    queryFn: async () => {
      const { data, error } = await supportAdminService.listAttachments(ticketId!);
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });
  return {
    replies: replies.data ?? [],
    attachments: attachments.data ?? [],
    isLoading: replies.isLoading,
  };
};

/**
 * Tempo real: ticket novo, mudança de estado ou resposta (de qualquer lado) atualiza a lista
 * e a conversa aberta, sem recarregar.
 */
export const useSupportRealtime = (onTicketsChange: () => void) => {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('admin-support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () =>
        onTicketsChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_replies' },
        payload => {
          const ticketId = (payload.new as { ticket_id?: string }).ticket_id;
          void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.marks });
          if (ticketId) void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.replies(ticketId) });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_attachments' },
        payload => {
          const ticketId = (payload.new as { ticket_id?: string }).ticket_id;
          if (ticketId) void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.attachments(ticketId) });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, onTicketsChange]);
};
