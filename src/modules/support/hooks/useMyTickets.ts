// Tickets do colaborador e a conversa do ticket aberto (com respostas em tempo real).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_ATTACHMENTS, DEMO_REPLIES, DEMO_TICKETS } from '../lib/demoData';
import type { SupportTicket, TicketReply } from '../lib/ticketRules';
import { supportService } from '../services/supportService';

export const TICKETS_KEY = ['support', 'tickets'] as const;

export const useMyTickets = () => {
  const { isPreview, user } = useWorkspace();
  const live = useQuery({
    queryKey: TICKETS_KEY,
    queryFn: async () => {
      const { data, error } = await supportService.listMine(user.employeeId);
      if (error || !data) throw error;
      return data;
    },
    enabled: !isPreview,
  });
  const data = isPreview ? { tickets: DEMO_TICKETS, attachments: DEMO_ATTACHMENTS } : live.data;
  return {
    tickets: data?.tickets ?? [],
    attachments: data?.attachments ?? {},
    isLoading: !isPreview && live.isLoading,
  };
};

export const useTicketThread = (ticket: SupportTicket | null) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const [demo, setDemo] = useState<Record<string, TicketReply[]>>(DEMO_REPLIES);
  const [isSending, setIsSending] = useState(false);
  const ticketId = ticket?.id ?? null;
  const key = ['support', 'replies', ticketId] as const;

  const live = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supportService.listReplies(ticketId as string);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview && !!ticketId,
  });

  // Respostas dos RH chegam em tempo real.
  useEffect(() => {
    if (isPreview || !ticketId) return;
    const channel = supabase
      .channel(`employee-ticket-replies-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_ticket_replies',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['support', 'replies', ticketId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, ticketId, qc]);

  const reply = async (message: string): Promise<boolean> => {
    if (!ticket || !message.trim()) return false;
    const text = message.trim();
    if (isPreview) {
      setDemo(all => ({
        ...all,
        [ticket.id]: [
          ...(all[ticket.id] ?? []),
          {
            id: `demo-${Date.now()}`,
            message: text,
            sender_role: 'employee',
            created_at: new Date().toISOString(),
            user_id: 'me',
          },
        ],
      }));
      return true;
    }
    setIsSending(true);
    const { error } = await supportService.reply(ticket, user.userId, text, {
      employeeName: user.name,
      employeeEmail: user.email,
      companyName: user.companyName ?? '',
    });
    setIsSending(false);
    if (error) {
      toast({ title: 'Erro', description: 'A resposta não foi enviada.', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Resposta enviada!' });
    await Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: TICKETS_KEY }),
    ]);
    return true;
  };

  return {
    replies: isPreview ? (ticketId ? (demo[ticketId] ?? []) : []) : (live.data ?? []),
    isLoading: !isPreview && live.isLoading,
    isSending,
    reply,
  };
};
