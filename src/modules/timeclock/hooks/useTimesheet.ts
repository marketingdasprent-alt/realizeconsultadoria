import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import { summarizeDays, type DaySummary, type TimeClockEntryWithRelations } from '@/lib/timeclock';
import { timeClockService } from '../services/timeClockService';

export interface TimesheetFilters {
  month: Date;
  companyId: string | null;
  employeeId: string | null;
  onlyFlagged: boolean;
}

export interface EmployeeTimesheet {
  employeeId: string;
  employeeName: string;
  days: DaySummary[];
  totalMinutes: number;
  flaggedCount: number;
  incompleteDays: number;
}

interface UseTimesheetResult {
  sheets: EmployeeTimesheet[];
  entries: TimeClockEntryWithRelations[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Folha de ponto mensal agrupada por colaborador.
 */
export const useTimesheet = ({
  month,
  companyId,
  employeeId,
  onlyFlagged,
}: TimesheetFilters): UseTimesheetResult => {
  const [entries, setEntries] = useState<TimeClockEntryWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthKey = month.toISOString();

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const base = new Date(monthKey);
    const { data, error: fetchError } = await timeClockService.getEntries({
      fromIso: startOfMonth(base).toISOString(),
      toIso: addDays(endOfMonth(base), 1).toISOString(),
      companyId,
      employeeId,
    });
    if (fetchError) setError('Erro ao carregar a folha de ponto');
    else setEntries(data);
    setIsLoading(false);
  }, [monthKey, companyId, employeeId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const sheets = useMemo(() => {
    const byEmployee = new Map<string, TimeClockEntryWithRelations[]>();
    entries.forEach(entry => {
      const list = byEmployee.get(entry.employee_id) ?? [];
      list.push(entry);
      byEmployee.set(entry.employee_id, list);
    });

    return Array.from(byEmployee.entries())
      .map(([id, list]) => {
        const days = summarizeDays(list);
        return {
          employeeId: id,
          employeeName: list[0]?.employee?.name ?? 'Colaborador',
          days,
          totalMinutes: days.reduce((sum, d) => sum + d.workedMinutes, 0),
          flaggedCount: list.filter(e => e.status === 'flagged').length,
          incompleteDays: days.filter(d => d.incomplete).length,
        };
      })
      .filter(sheet => !onlyFlagged || sheet.flaggedCount > 0 || sheet.incompleteDays > 0)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'pt'));
  }, [entries, onlyFlagged]);

  return { sheets, entries, isLoading, error, refetch: fetchEntries };
};
