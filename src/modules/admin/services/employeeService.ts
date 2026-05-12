// src/services/employeeService.ts
// Serviço para operações sobre colaboradores

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { PAGE_SIZES } from '@/lib/constants';

type Employee = Database['public']['Tables']['employees']['Row'];
type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];
type EmployeeUpdate = Database['public']['Tables']['employees']['Update'];

export const employeeService = {
  /**
   * Obter colaboradores e nome da empresa.
   * Sem `page` definido, devolve todos os registos (sem paginação) — usado
   * pela vista admin que mostra a tabela completa.
   */
  getAll: async (page?: number, pageSize: number = PAGE_SIZES.DEFAULT) => {
    try {
      let query = supabase
        .from('employees')
        .select('*, companies(id, name)', { count: 'exact' })
        .order('name');

      if (page !== undefined) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data, error: null, count };
    } catch (error) {
      return { data: null, error, count: null };
    }
  },

  /**
   * Obter colaboradores de uma empresa específica
   */
  getByCompany: async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter colaborador por ID com dados da empresa
   */
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, companies(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter colaborador por user_id (Supabase auth)
   */
  getByUserId: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, companies(*)')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Criar novo colaborador
   */
  create: async (employee: EmployeeInsert) => {
    try {
      const { data, error } = await supabase.from('employees').insert(employee).select().single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar colaborador
   */
  update: async (id: string, employee: EmployeeUpdate) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({ ...employee, updated_at: new Date().toISOString() })
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
   * Soft delete: desativa colaborador e bloqueia login (via Edge Function)
   */
  delete: async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-employee', {
        body: { employee_id: id },
      });

      if (error) {
        let errorMessage = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) errorMessage = body.error;
        } catch { /* response body is not JSON — use original message */ }
        throw new Error(errorMessage);
      }

      if (data?.error) throw new Error(data.error);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  /**
   * Ativar/desativar colaborador
   */
  toggleActive: async (id: string, isActive: boolean) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
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
   * Pesquisar colaboradores por nome ou email
   */
  search: async (query: string, companyId?: string) => {
    try {
      let q = supabase
        .from('employees')
        .select('*, companies(id, name)')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name')
        .limit(20);

      if (companyId) {
        q = q.eq('company_id', companyId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Criar novo colaborador com senha (via Edge Function)
   */
  createWithPassword: async (employeeData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-employee-with-password', {
        body: employeeData,
      });

      if (error) {
        let errorMessage = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) errorMessage = body.error;
        } catch { /* response body is not JSON — use original message */ }
        throw new Error(errorMessage);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar email de um colaborador (via Edge Function)
   */
  updateEmail: async (employeeId: string, newEmail: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-employee-email', {
        body: {
          employee_id: employeeId,
          new_email: newEmail,
        },
      });

      if (error) {
        let errorMessage = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) errorMessage = body.error;
        } catch { /* response body is not JSON — use original message */ }
        throw new Error(errorMessage);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Re-enviar convite/alterar senha (via Edge Function)
   */
  resendInvite: async (employeeId: string, newPassword: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('change-employee-password', {
        body: {
          employee_id: employeeId,
          new_password: newPassword,
          send_email: true,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

export type { Employee, EmployeeInsert, EmployeeUpdate };
