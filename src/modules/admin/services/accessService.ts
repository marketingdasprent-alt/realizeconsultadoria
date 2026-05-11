import { supabase } from '@/integrations/supabase/client';

export const accessService = {
  /**
   * Verifica se o usuário tem a role de admin
   */
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

  /**
   * Obtém as permissões detalhadas do admin
   */
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

  /**
   * Obtém a role principal do usuário da tabela user_roles
   */
  getUserRole: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { role: data?.role || null, error: null };
    } catch (error) {
      return { role: null, error };
    }
  },
};
