import { supabase } from '@/integrations/supabase/client';
import { isTransientQueryError } from '@/lib/retry';

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
   * e finalmente verifica se é um colaborador. Com `preferEmployee` (área do colaborador)
   * vê primeiro se é colaborador: quem é colaborador e admin na mesma conta entra como
   * colaborador no Workspace e como admin no admin.
   *
   * - `{ data: role, error: null }` → papel encontrado;
   * - `{ data: null, error: null }` → a conta não tem papel;
   * - `{ data: null, error }` → a BD não respondeu (em baixo, a arrancar, sem rede): não se
   *   sabe o papel e quem chama deve tentar de novo mais tarde, não tratar como "sem papel".
   */
  getUserRole: async (
    userId: string,
    { preferEmployee = false }: { preferEmployee?: boolean } = {}
  ): Promise<{ data: string | null; error: unknown }> => {
    try {
      const findEmployee = () =>
        supabase.from('employees').select('id').eq('user_id', userId).maybeSingle();

      if (preferEmployee) {
        const employee = await findEmployee();
        if (isTransientQueryError(employee.status, employee.error)) {
          return { data: null, error: employee.error };
        }
        if (employee.data) return { data: 'employee', error: null };
      }

      // 1. Verificar na tabela user_roles (novo sistema)
      const roles = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (isTransientQueryError(roles.status, roles.error))
        return { data: null, error: roles.error };
      if (roles.data?.role) {
        return { data: roles.data.role, error: null };
      }

      // 2. Fallback: Verificar se é admin pelo sistema de grupos
      // Usamos get_admin_permissions porque é SECURITY DEFINER e ignora RLS
      const permissions = await supabase.rpc('get_admin_permissions', {
        _user_id: userId,
      });

      if (isTransientQueryError(permissions.status, permissions.error)) {
        return { data: null, error: permissions.error };
      }
      if (!permissions.error && permissions.data && permissions.data.length > 0) {
        return { data: 'admin', error: null };
      }

      // 3. Fallback: Verificar se é um colaborador (com preferEmployee já se viu)
      if (preferEmployee) return { data: null, error: null };
      const employee = await findEmployee();

      if (isTransientQueryError(employee.status, employee.error)) {
        return { data: null, error: employee.error };
      }
      if (employee.data) {
        return { data: 'employee', error: null };
      }

      return { data: null, error: null };
    } catch (error: unknown) {
      console.error('Erro em getUserRole:', error);
      return { data: null, error };
    }
  },
};
