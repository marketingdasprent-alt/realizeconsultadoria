// src/services/companyService.ts
// Serviço para operações sobre empresas

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { CreateCompanyWithAdminInput } from '@/lib/schemas';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyUpdate = Database['public']['Tables']['companies']['Update'];

export const companyService = {
  /**
   * Obter todas as empresas ordenadas por nome
   */
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter empresas ativas ordenadas por nome
   */
  getActive: async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obter empresa por ID
   */
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Criar uma empresa nova com o seu primeiro administrador (e grupo opcional). Só o super admin: a função
   * de servidor cria a conta e chama rz_create_company, e a empresa, o administrador e o grupo nascem
   * juntos ou nada fica. Não há inserção direta em companies (a BD recusa-a).
   */
  createWithAdmin: async (input: CreateCompanyWithAdminInput) => {
    try {
      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: {
          email: input.admin_email.trim(),
          name: input.admin_name.trim(),
          password: input.admin_password,
          new_company: {
            name: input.name.trim(),
            nif: input.nif.trim(),
            email: input.email.trim(),
            group_id: input.group_id || null,
            group_name: input.group_name?.trim() || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { data: { id: String(data?.company_id ?? '') }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Atualizar empresa
   */
  update: async (id: string, company: CompanyUpdate) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({ ...company, updated_at: new Date().toISOString() })
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
   * Eliminar empresa por ID (só super admin, e só se não tiver colaboradores): rz_delete_company.
   */
  delete: async (id: string) => {
    try {
      const untyped: SupabaseClient = supabase;
      const { error } = await untyped.rpc('rz_delete_company', { p_company: id });
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      // As funções da BD põem a mensagem em português em `details` (message é só o código).
      const { details, message } = (error ?? {}) as { details?: string; message?: string };
      return {
        success: false,
        error: new Error(details || message || 'Não foi possível eliminar a empresa.'),
      };
    }
  },

  /**
   * Ativar/desativar empresa
   */
  toggleActive: async (id: string, isActive: boolean) => {
    try {
      const { data, error } = await supabase
        .from('companies')
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
} satisfies Record<string, (...args: unknown[]) => Promise<unknown>>;

export type { Company, CompanyUpdate };
