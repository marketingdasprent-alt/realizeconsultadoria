import { supabase } from '@/integrations/supabase/client';
import type { EmployeeProfile } from '../hooks/useEmployeeOutlet';

export const employeeProfileService = {
  /**
   * Ficha completa do colaborador autenticado (RLS: só a própria linha).
   */
  getCurrent: async (): Promise<{
    data: { employee: EmployeeProfile | null; email: string } | null;
    error: unknown;
  }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { data: null, error: null };
    const { data, error } = await supabase
      .from('employees')
      .select('*, companies(name)')
      .eq('user_id', session.user.id)
      .maybeSingle();
    return {
      data: { employee: (data as EmployeeProfile | null) ?? null, email: session.user.email ?? '' },
      error,
    };
  },
};
