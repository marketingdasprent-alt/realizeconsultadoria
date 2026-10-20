import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import type { BoardEmployee } from '../lib/todayBoard';
import { timeClockService } from './timeClockService';

export interface TodayBoardData {
  employees: BoardEmployee[];
  entries: TimeClockEntryWithRelations[];
  regulars: Set<string>;
  absences: Map<string, string>;
}

/** Registos desde há 36 h: apanha o dia em curso que começou ontem (turnos da noite). */
const LOOKBACK_MS = 36 * 3_600_000;

export const todayBoardService = {
  /**
   * Tudo o que o quadro "Hoje" precisa: colaboradores ativos, registos recentes, quem usa
   * o ponto (últimos 30 dias) e as ausências aprovadas de hoje.
   */
  getBoard: async (): Promise<{ data: TodayBoardData | null; error: unknown }> => {
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const [employees, entries, regulars, absences] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, user_id, company_id, companies(name)')
          .eq('is_active', true)
          .order('name'),
        timeClockService.getEntries({
          fromIso: new Date(now.getTime() - LOOKBACK_MS).toISOString(),
          toIso: new Date(now.getTime() + 60_000).toISOString(),
        }),
        supabase.rpc('time_clock_recent_punchers', { _days: 30 }),
        supabase
          .from('absence_periods')
          .select('absences!inner(employee_id, absence_type, status)')
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today)
          .in('absences.status', ['approved', 'partially_approved']),
      ]);
      const error = employees.error ?? entries.error ?? regulars.error ?? absences.error;
      if (error) throw error;

      const absentRows = (absences.data ?? []) as unknown as {
        absences: { employee_id: string; absence_type: string };
      }[];
      return {
        data: {
          employees: (employees.data ?? []).map(row => ({
            id: row.id,
            name: row.name,
            userId: row.user_id,
            companyId: row.company_id,
            companyName: (row.companies as { name: string } | null)?.name ?? null,
          })),
          entries: entries.data,
          regulars: new Set((regulars.data ?? []).map(row => row.employee_id)),
          absences: new Map(
            absentRows.map(row => [row.absences.employee_id, row.absences.absence_type])
          ),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },
};
