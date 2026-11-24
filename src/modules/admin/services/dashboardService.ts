import { supabase } from '@/integrations/supabase/client';
import { absenceTypeLabels } from '@/lib/absence-types';

export interface AbsentToday {
  employeeId: string;
  name: string;
  typeLabel: string;
  /** Último dia da ausência (AAAA-MM-DD). */
  until: string;
}

export interface DashboardOverview {
  totalCompanies: number;
  totalEmployees: number;
  pendingAbsences: number;
  openTickets: number;
  absentToday: AbsentToday[];
}

interface AbsenceRow {
  employee_id: string;
  status: string;
  absence_type: string;
  end_date: string;
  employees: { name: string } | null;
  absence_periods: { start_date: string; end_date: string; status: string }[] | null;
}

const isoToday = (): string => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

/** Quem está fora hoje: com um período aprovado que inclui hoje (ou a ausência toda aprovada). */
export const absentToday = (rows: AbsenceRow[], today: string): AbsentToday[] => {
  const absent = new Map<string, AbsentToday>();
  for (const row of rows) {
    const periods = row.absence_periods ?? [];
    const period = periods.find(
      p => p.status === 'approved' && p.start_date <= today && p.end_date >= today
    );
    const away = periods.length > 0 ? !!period : row.status === 'approved';
    if (!away || absent.has(row.employee_id)) continue;
    absent.set(row.employee_id, {
      employeeId: row.employee_id,
      name: row.employees?.name ?? 'Colaborador',
      typeLabel: absenceTypeLabels[row.absence_type] ?? absenceTypeLabels.other,
      until: period?.end_date ?? row.end_date,
    });
  }
  return [...absent.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};

const ABSENCE_COLUMNS =
  'employee_id, status, absence_type, end_date, employees(name), absence_periods(start_date, end_date, status)';

/** Ausências aprovadas que incluem hoje (só das empresas escolhidas, se houver escolha). */
const absencesToday = (today: string, companyIds: string[] | null) => {
  const query = supabase
    .from('absences')
    .select(ABSENCE_COLUMNS)
    .in('status', ['approved', 'partially_approved'])
    .lte('start_date', today)
    .gte('end_date', today);
  return companyIds ? query.in('company_id', companyIds) : query;
};

const EMPTY_OVERVIEW: DashboardOverview = {
  totalCompanies: 0,
  totalEmployees: 0,
  pendingAbsences: 0,
  openTickets: 0,
  absentToday: [],
};

export const dashboardService = {
  /**
   * Números do Dashboard (empresas, colaboradores ativos, pedidos por aprovar, tickets em
   * aberto) e a lista de quem está ausente hoje. `companyIds` é a escolha do seletor Empresa
   * (uma empresa ou as de um grupo); null é "Todas as empresas" (a base já só devolve as que a
   * conta pode ver).
   */
  getOverview: async (
    companyIds: string[] | null = null
  ): Promise<{ data: DashboardOverview | null; error: unknown }> => {
    if (companyIds && companyIds.length === 0) return { data: EMPTY_OVERVIEW, error: null };
    try {
      const today = isoToday();
      const [companies, employees, pending, absences, tickets] = await Promise.all([
        companyIds
          ? supabase
              .from('companies')
              .select('id', { count: 'exact', head: true })
              .in('id', companyIds)
          : supabase.from('companies').select('id', { count: 'exact', head: true }),
        companyIds
          ? supabase
              .from('employees')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true)
              .in('company_id', companyIds)
          : supabase
              .from('employees')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true),
        companyIds
          ? supabase
              .from('absences')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
              .in('company_id', companyIds)
          : supabase
              .from('absences')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending'),
        absencesToday(today, companyIds),
        companyIds
          ? supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .in('status', ['open', 'in_progress'])
              .in('company_id', companyIds)
          : supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .in('status', ['open', 'in_progress']),
      ]);
      const failed = [companies, employees, pending, absences, tickets].find(r => r.error);
      if (failed?.error) throw failed.error;

      return {
        data: {
          totalCompanies: companies.count ?? 0,
          totalEmployees: employees.count ?? 0,
          pendingAbsences: pending.count ?? 0,
          openTickets: tickets.count ?? 0,
          absentToday: absentToday((absences.data ?? []) as unknown as AbsenceRow[], today),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },
};
