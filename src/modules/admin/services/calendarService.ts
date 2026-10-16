import { supabase } from '@/integrations/supabase/client';
import type { Holiday } from '@/lib/vacation-utils';
import type { CalendarAbsence, CalendarEmployee } from '../lib/teamCalendar';

export interface CalendarCompany {
  id: string;
  name: string;
}

export interface CalendarMonthData {
  absences: CalendarAbsence[];
  employees: CalendarEmployee[];
  companies: CalendarCompany[];
  holidays: Holiday[];
}

interface EmployeeRow {
  id: string;
  name: string;
  company_id: string;
  companies: { name: string } | null;
}

export const calendarService = {
  /**
   * Ausências que tocam o mês (com os períodos e a pessoa), colaboradores ativos, empresas e
   * feriados dos anos do intervalo.
   */
  getMonth: async (
    from: string,
    to: string
  ): Promise<{ data: CalendarMonthData | null; error: unknown }> => {
    try {
      const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
      const [absences, employees, companies, holidays] = await Promise.all([
        supabase
          .from('absences')
          .select(
            'id, employee_id, start_date, end_date, absence_type, status, employees(name, company_id, companies(name)), absence_periods(id, start_date, end_date, status, period_type, start_time, end_time, business_days)'
          )
          .gte('end_date', from)
          .lte('start_date', to),
        supabase
          .from('employees')
          .select('id, name, company_id, companies(name)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('holidays').select('id, date, name, year, is_national').in('year', years),
      ]);
      const failed = [absences, employees, companies, holidays].find(r => r.error);
      if (failed?.error) throw failed.error;

      return {
        data: {
          absences: (absences.data ?? []) as unknown as CalendarAbsence[],
          employees: ((employees.data ?? []) as unknown as EmployeeRow[]).map(row => ({
            id: row.id,
            name: row.name,
            companyId: row.company_id,
            companyName: row.companies?.name ?? '',
          })),
          companies: companies.data ?? [],
          holidays: holidays.data ?? [],
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Pedidos de ausência à espera de aprovação (todos os meses). */
  pendingCount: async (): Promise<{ count: number; error: unknown }> => {
    const { count, error } = await supabase
      .from('absences')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return { count: count ?? 0, error };
  },
};
