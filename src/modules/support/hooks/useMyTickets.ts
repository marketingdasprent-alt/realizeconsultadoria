// Tickets do colaborador e a conversa do ticket aberto (com respostas em tempo real).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import {
  DEMO_ATTACHMENTS,
  DEMO_DEPARTMENTS,
  DEMO_REPLIES,
  DEMO_SUBJECTS,
  DEMO_TICKETS,
} from '../lib/demoData';
import type { SupportTicket, TicketReply } from '../lib/ticketRules';
import { replyWithFiles } from '../lib/ticketFiles';
import { supportService, type SupportSubject } from '../services/supportService';

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
        () => {
          void qc.invalidateQueries({ queryKey: ['support', 'replies', ticketId] });
          void qc.invalidateQueries({ queryKey: TICKETS_KEY });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, ticketId, qc]);

  /** Resposta com texto e/ou anexos (os anexos ficam também anotados na mensagem). */
  const reply = async (message: string, files: File[] = []): Promise<boolean> => {
    if (!ticket || (!message.trim() && !files.length)) return false;
    const text = replyWithFiles(message, files);
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
    const { failed } = error
      ? { failed: [] }
      : await supportService.uploadAttachments(ticket.id, user.userId, files);
    setIsSending(false);
    if (error) {
      toast({ title: 'Erro', description: 'A resposta não foi enviada.', variant: 'destructive' });
      return false;
    }
    if (failed.length)
      toast({
        title: 'Resposta enviada, mas alguns anexos falharam',
        description: failed.join(', '),
        variant: 'destructive',
      });
    else toast({ title: 'Resposta enviada!' });
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

/** Departamentos e assuntos do formulário de novo pedido, e a criação do ticket. */
export const useNewTicket = (enabled: boolean) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const options = useQuery({
    queryKey: ['support', 'options'],
    queryFn: async () => {
      const { data, error } = await supportService.listOptions();
      if (error) throw error;
      return data;
    },
    enabled: enabled && !isPreview,
    staleTime: 10 * 60_000,
  });

  const create = async (input: {
    departmentId: string;
    subject: SupportSubject;
    message: string;
    files: File[];
  }): Promise<string | null> => {
    if (isPreview) {
      toast({ title: 'Pré-visualização', description: 'Criar um ticket usa dados reais.' });
      return null;
    }
    const { id, error } = await supportService.create(
      {
        employeeId: user.employeeId,
        companyId: user.companyId,
        departmentId: input.departmentId,
        subject: input.subject.label.trim(),
        message: input.message.trim(),
        priority: input.subject.default_priority || 'medium',
      },
      { employeeName: user.name, employeeEmail: user.email, companyName: user.companyName ?? '' }
    );
    if (error || !id) {
      toast({ title: 'Erro', description: 'O pedido não foi criado.', variant: 'destructive' });
      return null;
    }
    const { failed } = await supportService.uploadAttachments(id, user.userId, input.files);
    if (failed.length)
      toast({
        title: 'Pedido criado, mas alguns anexos falharam',
        description: failed.join(', '),
        variant: 'destructive',
      });
    else toast({ title: 'Pedido enviado aos RH' });
    await qc.invalidateQueries({ queryKey: TICKETS_KEY });
    return id;
  };

  return {
    departments: isPreview ? DEMO_DEPARTMENTS : (options.data?.departments ?? []),
    subjects: isPreview ? DEMO_SUBJECTS : (options.data?.subjects ?? []),
    isLoading: !isPreview && options.isLoading,
    create,
  };
};
