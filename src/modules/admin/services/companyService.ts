// src/services/companyService.ts
// Serviço para operações sobre empresas

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
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
   * Criar nova empresa
   */
  create: async (company: CompanyInsert) => {
    try {
      const { data, error } = await supabase.from('companies').insert(company).select().single();
      if (error) throw error;
      return { data, error: null };
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
   * Eliminar empresa por ID
   */
  delete: async (id: string) => {
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
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

export type { Company, CompanyInsert, CompanyUpdate };
