// src/services/ticketService.ts
// Serviço para operações sobre tickets de suporte

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { PAGE_SIZES, TICKET_STATUSES } from '@/lib/constants';

type Ticket = Database['public']['Tables']['support_tickets']['Row'];
type TicketInsert = Database['public']['Tables']['support_tickets']['Insert'];
type TicketUpdate = Database['public']['Tables']['support_tickets']['Update'];

type TicketStatus = (typeof TICKET_STATUSES)[keyof typeof TICKET_STATUSES];

export const ticketService = {
  /**
   * Obter todos os tickets com paginação
   */
  getAll: async (page = 1, pageSize = PAGE_SIZES.DEFAULT, status?: TicketStatus) => {
    try {
      let query = supabase
        .from('support_tickets')
        .select('*, employees(id, name, company_id, companies(name)), support_departments(name)', {
          count: 'exact',
        });

      if (status) {
        query = query.eq('status', status);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data, error: null, count };
    } catch (error) {
      return { data: null, error, count: null };
    }
  },

  /**
   * Obter tickets de um colaborador
   */
  getByEmployee: async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, support_departments(name), support_ticket_replies(*)')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter ticket por ID com mensagens
   */
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(
          '*, employees(id, name, email), support_departments(name), support_ticket_replies(*)'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter contagem de tickets abertos (para badge)
   */
  getOpenCount: async () => {
    try {
      const { count, error } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', TICKET_STATUSES.OPEN);

      if (error) throw error;
      return { count: count ?? 0, error: null };
    } catch (error) {
      return { count: 0, error };
    }
  },

  /**
   * Criar novo ticket
   */
  create: async (ticket: TicketInsert) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert(ticket)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar ticket
   */
  update: async (id: string, ticket: TicketUpdate) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .update({ ...ticket, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar estado do ticket
   */
  updateStatus: async (id: string, status: TicketStatus) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Eliminar ticket
   */
  delete: async (id: string) => {
    try {
      const { error } = await supabase.from('support_tickets').delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },
};

export type { Ticket, TicketInsert, TicketUpdate, TicketStatus };
