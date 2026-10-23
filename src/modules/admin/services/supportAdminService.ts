// Suporte (admin): conversa dos tickets, nota interna e anexos.
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import { replyWithFiles } from '@/modules/support/lib/ticketFiles';
import type { TicketAttachment } from '@/modules/support/lib/ticketRules';
import { supportService } from '@/modules/support/services/supportService';
import type { ReplyMark } from '../lib/supportTickets';

export interface TicketReplyRow extends ReplyMark {
  id: string;
  user_id: string | null;
  message: string;
}

export type TicketAttachmentRow = TicketAttachment;

/** Os anexos novos estão em ticket-attachments; os mais antigos podem estar nos outros. */
const ATTACHMENT_BUCKETS = ['ticket-attachments', 'employee-files'];

export const supportAdminService = {
  /** Quem falou por último em cada ticket (para "à espera de resposta"). */
  replyMarks: async () => {
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .select('ticket_id, sender_role, created_at');
    return { data: (data ?? []) as ReplyMark[], error };
  },

  listReplies: async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .select('id, ticket_id, user_id, sender_role, message, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return { data: (data ?? []) as TicketReplyRow[], error };
  },

  /**
   * Resposta do suporte: fica na conversa (o colaborador recebe aviso na app pela BD) e vai
   * por email. Um ticket "Aberto" passa a "Em curso". Os anexos sobem antes da resposta,
   * para o colaborador os ver quando a resposta chega; devolve os que falharam.
   */
  reply: async (ticket: SupportTicket, message: string, files: File[] = []) => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return { error: new Error('A sessão terminou. Entre outra vez.'), failed: [] };
    const { failed } = files.length
      ? await supportService.uploadAttachments(ticket.id, userId, files)
      : { failed: [] as string[] };
    const sent = files.filter(file => !failed.includes(file.name));
    const text = replyWithFiles(message, sent);
    if (!text) return { error: new Error('Os anexos não foram enviados.'), failed };
    const { error } = await supabase.from('support_ticket_replies').insert({
      ticket_id: ticket.id,
      user_id: userId,
      sender_role: 'admin',
      message: text,
    });
    if (error) return { error, failed };
    const newStatus = ticket.status === 'open' ? 'in_progress' : ticket.status;
    if (newStatus !== ticket.status) {
      await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticket.id);
    }
    // Email ao colaborador (melhor esforço: a resposta já está gravada).
    void supabase.functions.invoke('send-ticket-status-notification', {
      body: {
        ticketId: ticket.id,
        employeeEmail: ticket.employees?.email,
        employeeName: ticket.employees?.name,
        ticketSubject: ticket.subject,
        oldStatus: ticket.status,
        newStatus,
        adminNotes: text,
        notificationType: 'notes_added',
      },
    });
    return { error: null, failed };
  },

  getInternalNote: async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_ticket_internal_notes')
      .select('notes, updated_at')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    return { data, error };
  },

  saveInternalNote: async (ticketId: string, notes: string) => {
    const { data: auth } = await supabase.auth.getSession();
    const { error } = await supabase.from('support_ticket_internal_notes').upsert({
      ticket_id: ticketId,
      notes,
      updated_at: new Date().toISOString(),
      updated_by: auth.session?.user.id ?? null,
    });
    return { error };
  },

  listAttachments: async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_ticket_attachments')
      .select(
        'id, ticket_id, file_name, file_path, file_size, content_type, created_at, uploaded_by'
      )
      .eq('ticket_id', ticketId)
      .order('created_at');
    return { data: (data ?? []) as TicketAttachmentRow[], error };
  },

  /** Endereço temporário (5 min) do anexo. */
  attachmentUrl: async (filePath: string): Promise<string | null> => {
    const path = filePath.replace(/^\/+/, '');
    for (const bucket of ATTACHMENT_BUCKETS) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  },
};
