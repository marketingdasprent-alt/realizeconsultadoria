import { supabase } from '@/integrations/supabase/client';

export const equipmentService = {
  /**
   * Obtém equipamentos atribuídos a um colaborador
   */
  getByEmployeeId: async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('equipments')
        .select('*')
        .eq('employee_id', employeeId)
        .order('brand');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Obtém todos os equipamentos com paginação opcional
   */
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('equipments')
        .select('*, employees(name)')
        .order('brand');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
