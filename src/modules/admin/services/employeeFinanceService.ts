import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type EmployeeMonthlyFinance =
  Database['public']['Tables']['employee_monthly_finances']['Row'];

export type EmployeeMonthlyFinanceUpsert =
  Database['public']['Tables']['employee_monthly_finances']['Insert'];

export interface FinanceFields {
  valor_recebido: number;
  valor_subsidio_alimentacao: number;
  valor_cartao_da: number;
}

export const employeeFinanceService = {
  /**
   * Carrega todos os registos financeiros de um mês/ano específico.
   */
  listByPeriod: async (year: number, month: number) => {
    try {
      const { data, error } = await supabase
        .from('employee_monthly_finances')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [] as EmployeeMonthlyFinance[], error };
    }
  },

  /**
   * Cria ou actualiza um registo mensal (upsert por employee_id+year+month).
   */
  upsert: async (
    employeeId: string,
    year: number,
    month: number,
    fields: Partial<FinanceFields>
  ) => {
    try {
      const payload: EmployeeMonthlyFinanceUpsert = {
        employee_id: employeeId,
        year,
        month,
        valor_recebido: fields.valor_recebido ?? 0,
        valor_subsidio_alimentacao: fields.valor_subsidio_alimentacao ?? 0,
        valor_cartao_da: fields.valor_cartao_da ?? 0,
      };

      const { data, error } = await supabase
        .from('employee_monthly_finances')
        .upsert(payload, { onConflict: 'employee_id,year,month' })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
