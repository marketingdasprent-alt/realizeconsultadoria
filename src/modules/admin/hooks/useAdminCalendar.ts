import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eachDayOfInterval, endOfMonth, startOfMonth } from 'date-fns';
import {
  approvedDaysInMonth,
  entriesForDay,
  isoDay,
  type CalendarAbsence,
  type DayEntry,
} from '../lib/teamCalendar';
import { calendarService, type CalendarMonthData } from '../services/calendarService';

const EMPTY: CalendarMonthData = { absences: [], employees: [], companies: [], holidays: [] };

/**
 * Dados do calendário de um mês, filtrados pela empresa ('all' = todas): os dias, quem está
 * fora em cada um e os dias aprovados de cada pessoa. O mês anterior fica visível enquanto o
 * novo carrega, e voltar a um mês já visto é imediato.
 */
export const useAdminCalendar = (month: Date, companyId: string) => {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const from = isoDay(monthStart);
  const to = isoDay(monthEnd);

  const query = useQuery({
    queryKey: ['admin', 'calendar', from],
    queryFn: async () => {
      const { data, error } = await calendarService.getMonth(from, to);
      if (error || !data) throw error ?? new Error('Sem dados do calendário');
      return data;
    },
    placeholderData: previous => previous,
    staleTime: 60_000,
  });

  const pending = useQuery({
    queryKey: ['admin', 'calendar', 'pending'],
    queryFn: async () => (await calendarService.pendingCount()).count,
    staleTime: 60_000,
  });

  const data = query.data ?? EMPTY;

  const view = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const inCompany = (absence: CalendarAbsence) =>
      companyId === 'all' || absence.employees?.company_id === companyId;
    const absences = data.absences.filter(inCompany);
    const employees = data.employees.filter(e => companyId === 'all' || e.companyId === companyId);
    const entriesByDay: DayEntry[][] = days.map(day => entriesForDay(absences, day, data.holidays));
    const approvedDays = approvedDaysInMonth(
      absences,
      startOfMonth(month),
      endOfMonth(month),
      data.holidays
    );
    return { days, absences, employees, entriesByDay, approvedDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, companyId, from]);

  return {
    ...view,
    companies: data.companies,
    holidays: data.holidays,
    pendingCount: pending.data ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};
