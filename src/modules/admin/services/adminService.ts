// src/services/adminService.ts
// Serviço centralizado para operações de admin

import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type Absence = Database['public']['Tables']['absences']['Row'];

export const adminService = {
  // Empresas
  getCompanies: async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*').order('name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  getCompanyById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  createCompany: async (company: Omit<Company, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase.from('companies').insert(company).select().single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Colaboradores
  getEmployees: async (page = 1, pageSize = 20) => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('employees')
        .select('*, companies(name)', { count: 'exact' })
        .order('first_name')
        .range(from, to);

      if (error) throw error;
      return { data, error: null, count };
    } catch (error) {
      return { data: null, error, count: null };
    }
  },

  getEmployeeById: async (id: string) => {
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

  // Ausências
  getAbsences: async (page = 1, pageSize = 20, status?: string) => {
    try {
      let query = supabase
        .from('absences')
        .select('*, employees(first_name, last_name)', { count: 'exact' });

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

  // Verificar se user é admin
  checkAdminRole: async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });

      if (error) throw error;
      return { isAdmin: data || false, error: null };
    } catch (error) {
      return { isAdmin: false, error };
    }
  },

  // Obter permissões do admin
  getAdminPermissions: async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_admin_permissions', {
        _user_id: userId,
      });

      if (error) throw error;
      return { permissions: data || [], error: null };
    } catch (error) {
      return { permissions: [], error };
    }
  },
};
