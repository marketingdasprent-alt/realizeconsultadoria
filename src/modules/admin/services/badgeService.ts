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
  /**
   * Contagens para os números vermelhos do menu (só contagens, sem trazer linhas). `companyIds` é
   * a escolha do seletor Empresa; null é "Todas as empresas" (a base já só devolve as da conta).
   */
  counts: async (
    companyIds: string[] | null = null
  ): Promise<{ data: AdminBadgeCounts | null; error: unknown }> => {
    if (companyIds && companyIds.length === 0) {
      return { data: { pendingDocuments: 0, pendingRequests: 0, openTickets: 0 }, error: null };
    }
    const registrationOnly = `category.is.null,category.in.(${REGISTRATION_CATEGORIES.join(',')})`;
    const [documents, requests, tickets] = await Promise.all([
      // A empresa de um documento é a da ficha do colaborador (o embed só entra com escolha).
      companyIds
        ? supabase
            .from('employee_documents')
            .select('id, employees!inner(company_id)', { count: 'exact', head: true })
            .eq('status', 'pending')
            .or(registrationOnly)
            .in('employees.company_id', companyIds)
        : supabase
            .from('employee_documents')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .or(registrationOnly),
      companyIds
        ? supabase
            .from('absences')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .in('company_id', companyIds)
        : supabase
            .from('absences')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
      companyIds
        ? supabase
            .from('support_tickets')
            .select('id', { count: 'exact', head: true })
            .in('status', ['open', 'in_progress'])
            .in('company_id', companyIds)
        : supabase
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
