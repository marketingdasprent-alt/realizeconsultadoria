// Tickets de suporte do colaborador (as mesmas tabelas, buckets e emails de sempre).
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import type { SupportTicket, TicketAttachment, TicketReply } from '../lib/ticketRules';

// Anexos antigos podem estar noutros buckets: tenta-os por ordem.
const BUCKETS = ['ticket-attachments', 'employee-files', 'documents', 'employees'];

export interface SupportDepartment {
  id: string;
  name: string;
}

export interface SupportSubject {
  id: string;
  label: string;
  default_priority: string;
  department_id: string | null;
}

export interface NewTicketInput {
  employeeId: string;
  companyId: string;
  departmentId: string;
  subject: string;
  message: string;
  priority: string;
}

export const supportService = {
  /** Departamentos e assuntos ativos (os mesmos do formulário antigo). */
  listOptions: async () => {
    const [departments, subjects] = await Promise.all([
      supabase
        .from('support_departments')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('support_ticket_subjects')
        .select('id, label, default_priority, department_id')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    return {
      data: {
        departments: (departments.data ?? []) as SupportDepartment[],
        subjects: (subjects.data ?? []) as SupportSubject[],
      },
      error: departments.error ?? subjects.error,
    };
  },

  /** Novo ticket (os mesmos campos de sempre) e o email aos RH do departamento. */
  create: async (
    input: NewTicketInput,
    from: { employeeName: string; employeeEmail: string; companyName: string }
  ) => {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        employee_id: input.employeeId,
        company_id: input.companyId,
        subject: input.subject,
        message: input.message,
        priority: input.priority,
        department_id: input.departmentId,
      })
      .select('id')
      .single();
    if (error || !data) return { id: null, error };
    supabase.functions
      .invoke('send-ticket-notification', {
        body: {
          ...from,
          subject: input.subject,
          priority: input.priority,
          message: input.message,
          departmentId: input.departmentId,
        },
      })
      .catch(err => console.error('Falhou o email aos RH:', err));
    return { id: data.id as string, error: null };
  },

  /** Anexos de um ticket ("<ticket>/<data>_<nome>"); devolve os que falharam. */
  uploadAttachments: async (ticketId: string, userId: string, files: File[]) => {
    const failed: string[] = [];
    for (const file of files) {
      const path = `${ticketId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(path, file, { contentType: file.type });
      const { error } = uploadError
        ? { error: uploadError }
        : await supabase.from('support_ticket_attachments').insert({
            ticket_id: ticketId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            content_type: file.type,
            uploaded_by: userId,
          });
      if (error) failed.push(file.name);
    }
    return { failed };
  },

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
        .select(
          'id, ticket_id, file_name, file_path, file_size, content_type, created_at, uploaded_by'
        )
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
