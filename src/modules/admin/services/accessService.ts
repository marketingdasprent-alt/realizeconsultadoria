import { supabase } from '@/integrations/supabase/client';

export const accessService = {
  /**
   * Verifica se o usuário tem a role de admin
   */
  checkAdminRole: async (userId: string) => {
    try {
      // 1. Verificar na tabela user_roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData?.role === 'admin') {
        return { isAdmin: true, error: null };
      }

      // 2. Fallback: Verificar pelos grupos
      const { data: permissions, error: permError } = await supabase.rpc('get_admin_permissions', {
        _user_id: userId,
      });

      if (!permError && permissions && permissions.length > 0) {
        return { isAdmin: true, error: null };
      }

      return { isAdmin: false, error: null };
    } catch (error) {
      console.error('Erro em checkAdminRole:', error);
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
   * Obtém a role principal do usuário.
   * Tenta primeiro na tabela user_roles, depois verifica se é admin pelos grupos,
   * e finalmente verifica se é um colaborador.
   */
  getUserRole: async (userId: string) => {
    try {
      // 1. Verificar na tabela user_roles (novo sistema)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData?.role) {
        return { role: roleData.role as any, error: null };
      }

      // 2. Fallback: Verificar se é admin pelo sistema de grupos
      // Usamos get_admin_permissions porque é SECURITY DEFINER e ignora RLS
      const { data: permissions, error: permError } = await supabase.rpc('get_admin_permissions', {
        _user_id: userId,
      });

      if (!permError && permissions && permissions.length > 0) {
        return { role: 'admin', error: null };
      }

      // 3. Fallback: Verificar se é um colaborador
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (employeeData) {
        return { role: 'employee', error: null };
      }

      return { role: null, error: null };
    } catch (error) {
      console.error('Erro em getUserRole:', error);
      return { role: null, error };
    }
  },
};
