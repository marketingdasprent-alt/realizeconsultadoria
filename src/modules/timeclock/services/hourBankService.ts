import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_HOUR_BANK,
  parseAbsenceRules,
  type BankAbsence,
  type HourBankSettings,
} from '../lib/hourBank';

/** Regras do banco de horas (uma só linha) e as ausências aprovadas que entram no saldo. */
export const hourBankService = {
  getSettings: async (): Promise<{ data: HourBankSettings; error: unknown }> => {
    const { data, error } = await supabase
      .from('time_clock_settings')
      .select('daily_minutes, workdays, absence_rules, starts_on')
      .maybeSingle();
    if (!data) return { data: DEFAULT_HOUR_BANK, error };
    return {
      data: {
        dailyMinutes: data.daily_minutes,
        workdays: data.workdays ?? DEFAULT_HOUR_BANK.workdays,
        absenceRules: parseAbsenceRules(data.absence_rules),
        startsOn: data.starts_on ?? null,
      },
      error,
    };
  },

  /** Só admins (a BD recusa aos outros). */
  saveSettings: async (settings: HourBankSettings) => {
    const { data: auth } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('time_clock_settings')
      .update({
        daily_minutes: settings.dailyMinutes,
        workdays: settings.workdays,
        absence_rules: settings.absenceRules,
        ...(settings.startsOn ? { starts_on: settings.startsOn } : {}),
        updated_by: auth.session?.user.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
    return { error };
  },

  /** Ausências aprovadas (ou aprovadas em parte) que tocam o intervalo; uma pessoa ou todas. */
  getAbsences: async (from: string, to: string, employeeId: string | null) => {
    let query = supabase
      .from('absences')
      .select(
        'employee_id, absence_type, status, start_date, end_date, absence_periods(start_date, end_date, status, period_type, start_time, end_time)'
      )
      .in('status', ['approved', 'partially_approved'])
      .lte('start_date', to)
      .gte('end_date', from);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    return { data: (data ?? []) as unknown as BankAbsence[], error };
  },
};
