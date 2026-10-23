// Suporte no Workspace: quem é de uma equipa ligada a um departamento de suporte atende
// esses tickets (ex.: Desenvolvimento → "Marketing | TI"). Tudo filtrado pela BD (RLS).
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';

const DESK_KEYS = {
  departments: ['support', 'desk', 'departments'] as const,
  tickets: ['support', 'desk', 'tickets'] as const,
};

/** Os departamentos de suporte que o utilizador atende (vazio = não é de nenhuma equipa). */
export const useSupportDesk = () => {
  const { isPreview } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: DESK_KEYS.departments,
    queryFn: async () => {
      const { data: ids, error } = await supabase.rpc('rz_support_desk_departments');
      if (error) throw error;
      const list = (ids ?? []) as string[];
      if (!list.length) return [];
      const { data: rows, error: deptError } = await supabase
        .from('support_departments')
        .select('id, name')
        .in('id', list)
        .order('sort_order');
      if (deptError) throw deptError;
      return rows ?? [];
    },
    enabled: !isPreview,
    staleTime: 10 * 60_000,
  });
  const departments = data ?? [];
  return { departments, isAgent: departments.length > 0, isLoading: !isPreview && isLoading };
};

/** A fila da equipa e a mudança de estado (avisa o colaborador por email e na app). */
export const useDeskTickets = (enabled: boolean) => {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: DESK_KEYS.tickets,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc('support_desk_tickets');
      if (error) throw error;
      return (rows ?? []) as unknown as SupportTicket[];
    },
    enabled,
  });
  const tickets = data ?? [];

  const updateTicketStatus = useCallback(
    async (ticketId: string, status: string) => {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket || ticket.status === status) return;
      const done = status === 'resolved' || status === 'closed';
      const { data: auth } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status,
          resolved_at: done ? new Date().toISOString() : null,
          resolved_by: done ? (auth.session?.user.id ?? null) : null,
        })
        .eq('id', ticketId);
      if (error) throw error;
      void supabase.functions.invoke('send-ticket-status-notification', {
        body: {
          ticketId,
          employeeEmail: ticket.employees?.email,
          employeeName: ticket.employees?.name,
          ticketSubject: ticket.subject,
          oldStatus: ticket.status,
          newStatus: status,
          adminNotes: ticket.admin_notes,
          notificationType: 'status_change',
        },
      });
      await qc.invalidateQueries({ queryKey: DESK_KEYS.tickets });
    },
    [tickets, qc]
  );

  return { tickets, isLoading: enabled && isLoading, refetch, updateTicketStatus };
};
