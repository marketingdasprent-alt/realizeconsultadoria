// Tickets de suporte do colaborador (as mesmas tabelas, buckets e emails de sempre).
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket, TicketAttachment, TicketReply } from '../lib/ticketRules';

// Anexos antigos podem estar noutros buckets: tenta-os por ordem.
const BUCKETS = ['ticket-attachments', 'employee-files', 'documents', 'employees'];

export const supportService = {
  /** Os tickets do colaborador, mais recentes primeiro, com os anexos. */
  listMine: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error };
    const tickets = (data ?? []) as SupportTicket[];
    const ids = tickets.map(t => t.id);
    const attachments: Record<string, TicketAttachment[]> = {};
    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from('support_ticket_attachments')
        .select('id, ticket_id, file_name, file_path, file_size, content_type')
        .in('ticket_id', ids);
      for (const row of (rows ?? []) as TicketAttachment[]) {
        (attachments[row.ticket_id] ??= []).push(row);
      }
    }
    return { data: { tickets, attachments }, error: null };
  },

  listReplies: async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return { data: (data ?? []) as TicketReply[], error };
  },

  /** Resposta do colaborador + email aos RH do departamento. */
  reply: async (
    ticket: SupportTicket,
    userId: string,
    message: string,
    from: { employeeName: string; employeeEmail: string; companyName: string }
  ) => {
    const { error } = await supabase.from('support_ticket_replies').insert({
      ticket_id: ticket.id,
      user_id: userId,
      sender_role: 'employee',
      message,
    });
    if (error) return { error };
    supabase.functions
      .invoke('send-ticket-reply-notification', {
        body: {
          ticketId: ticket.id,
          ...from,
          subject: ticket.subject,
          message,
          departmentId: ticket.department_id,
        },
      })
      .catch(err => console.error('Falhou o email aos RH:', err));
    return { error: null };
  },

  /** URL temporário de um anexo (com os buckets antigos e o URL público como recurso). */
  getAttachmentUrl: async (filePath: string): Promise<string | null> => {
    const path = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    for (const bucket of BUCKETS) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (data?.signedUrl) return data.signedUrl;
    }
    for (const bucket of BUCKETS) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      try {
        if (data?.publicUrl && (await fetch(data.publicUrl, { method: 'HEAD' })).ok) {
          return data.publicUrl;
        }
      } catch {
        // tenta o seguinte
      }
    }
    return null;
  },
};
