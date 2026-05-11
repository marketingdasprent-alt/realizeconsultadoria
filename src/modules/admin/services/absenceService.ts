// src/services/absenceService.ts
// Serviço para operações sobre pedidos de ausência

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { PAGE_SIZES, ABSENCE_STATUSES } from '@/lib/constants';

type Absence = Database['public']['Tables']['absences']['Row'];
type AbsenceInsert = Database['public']['Tables']['absences']['Insert'];
type AbsenceUpdate = Database['public']['Tables']['absences']['Update'];

type AbsenceStatus = (typeof ABSENCE_STATUSES)[keyof typeof ABSENCE_STATUSES];

export const absenceService = {
  /**
   * Obter todas as ausências com paginação e dados do colaborador
   */
  getAll: async (page = 1, pageSize = PAGE_SIZES.DEFAULT, status?: AbsenceStatus) => {
    try {
      let query = supabase
        .from('absences')
        .select('*, employees(id, name, company_id, companies(name))', { count: 'exact' });

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
   * Obter ausências de um colaborador específico
   */
  getByEmployee: async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .select('*, absence_periods(*)')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter ausência por ID com todos os detalhes
   */
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .select(
          '*, employees(id, name, email, company_id), absence_periods(*), absence_documents(*)'
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
   * Obter ausências pendentes (para badge de notificação)
   */
  getPendingCount: async () => {
    try {
      const { count, error } = await supabase
        .from('absences')
        .select('*', { count: 'exact', head: true })
        .eq('status', ABSENCE_STATUSES.PENDING);

      if (error) throw error;
      return { count: count ?? 0, error: null };
    } catch (error) {
      return { count: 0, error };
    }
  },

  /**
   * Criar pedido de ausência
   */
  create: async (absence: AbsenceInsert) => {
    try {
      const { data, error } = await supabase.from('absences').insert(absence).select().single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar ausência
   */
  update: async (id: string, absence: AbsenceUpdate) => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .update({ ...absence, updated_at: new Date().toISOString() })
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
   * Aprovar pedido de ausência
   */
  approve: async (id: string, approvedBy: string) => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .update({
          status: ABSENCE_STATUSES.APPROVED,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
   * Rejeitar pedido de ausência
   */
  reject: async (id: string, rejectionReason: string) => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .update({
          status: ABSENCE_STATUSES.REJECTED,
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
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
   * Eliminar ausência
   */
  delete: async (id: string) => {
    try {
      const { error } = await supabase.from('absences').delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },
};

export type { Absence, AbsenceInsert, AbsenceUpdate, AbsenceStatus };
