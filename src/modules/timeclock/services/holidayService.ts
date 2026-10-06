import { supabase } from '@/integrations/supabase/client';
import type { PrintHoliday } from '@/lib/timesheet-print';

export const holidayService = {
  /**
   * Feriados entre duas datas (yyyy-MM-dd, inclusive).
   */
  getRange: async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('holidays')
      .select('date, name')
      .gte('date', from)
      .lte('date', to)
      .order('date');
    return { data: (data ?? []) as PrintHoliday[], error };
  },
};
