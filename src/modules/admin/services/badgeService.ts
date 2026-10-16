import { supabase } from '@/integrations/supabase/client';
import { REGISTRATION_CATEGORIES } from '@/modules/documents/lib/registration';

export interface AdminBadgeCounts {
  /** Documentos de registo (ou sem tipo) enviados pelos colaboradores, por aprovar. */
  pendingDocuments: number;
  /** Pedidos de férias/ausência por aprovar. */
  pendingRequests: number;
  /** Tickets de suporte abertos ou em curso. */
  openTickets: number;
}

export const badgeService = {
  /** Contagens para os números vermelhos do menu (só contagens, sem trazer linhas). */
  counts: async (): Promise<{ data: AdminBadgeCounts | null; error: unknown }> => {
    const [documents, requests, tickets] = await Promise.all([
      supabase
        .from('employee_documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .or(`category.is.null,category.in.(${REGISTRATION_CATEGORIES.join(',')})`),
      supabase
        .from('absences')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']),
    ]);
    const error = documents.error ?? requests.error ?? tickets.error;
    if (error) return { data: null, error };
    return {
      data: {
        pendingDocuments: documents.count ?? 0,
        pendingRequests: requests.count ?? 0,
        openTickets: tickets.count ?? 0,
      },
      error: null,
    };
  },
};
