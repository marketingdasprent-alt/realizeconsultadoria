import { supabase } from '@/integrations/supabase/client';
import type { AdminAccount } from '../lib/adminLink';

export const adminLinkService = {
  /** Contas de administrador e a que ficha estão ligadas (só para super admins). */
  accounts: async (): Promise<{ data: AdminAccount[]; error: unknown }> => {
    const { data, error } = await supabase.rpc('admin_link_candidates');
    return {
      data: (data ?? []).map(row => ({
        userId: row.user_id,
        name: row.name,
        email: row.email,
        linkedEmployeeId: row.linked_employee_id,
        linkedEmployeeName: row.linked_employee_name,
        isEmployeeAccount: row.is_employee_account,
      })),
      error,
    };
  },

  /** Liga (ou desliga, com null) a conta de admin à ficha. A BD só deixa ao super admin. */
  link: async (employeeId: string, adminUserId: string | null): Promise<{ error: unknown }> => {
    const { error } = await supabase
      .from('employees')
      .update({ admin_user_id: adminUserId })
      .eq('id', employeeId);
    return { error };
  },
};
