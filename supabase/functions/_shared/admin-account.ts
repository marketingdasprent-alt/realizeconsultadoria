// Quem é administrador, para as funções chamadas pelo Workspace (onde a pessoa entra quase
// sempre com a conta de colaborador): vale o papel admin ou um grupo de admin ativo, na conta da
// sessão ou na conta de admin ligada à ficha (employees.admin_user_id).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const isAdminAccount = async (db: SupabaseClient, userId: string): Promise<boolean> => {
  const { data: linked } = await db
    .from('employees')
    .select('admin_user_id')
    .eq('user_id', userId)
    .not('admin_user_id', 'is', null);
  const ids = [userId, ...(linked ?? []).map(row => row.admin_user_id as string)];
  const [role, groups] = await Promise.all([
    db.from('user_roles').select('role').in('user_id', ids).eq('role', 'admin').limit(1),
    db
      .from('admin_group_members')
      .select('admin_groups!inner(is_active)')
      .in('user_id', ids)
      .eq('admin_groups.is_active', true)
      .limit(1),
  ]);
  return (role.data?.length ?? 0) > 0 || (groups.data?.length ?? 0) > 0;
};
