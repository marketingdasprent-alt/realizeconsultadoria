import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { DaySummary } from '@/lib/timeclock';
import {
  DEFAULT_HOUR_BANK,
  monthHourBank,
  type BankAbsence,
  type MonthBank,
} from '../lib/hourBank';
import { holidayService } from '../services/holidayService';
import { hourBankService } from '../services/hourBankService';

export const HOUR_BANK_SETTINGS_KEY = ['timeclock', 'hour-bank', 'settings'] as const;

/** Regras do banco de horas (horas por dia, dias de trabalho, ausências justificadas). */
export const useHourBankSettings = () =>
  useQuery({
    queryKey: HOUR_BANK_SETTINGS_KEY,
    queryFn: async () => (await hourBankService.getSettings()).data,
    staleTime: 10 * 60_000,
  });

/**
 * Tudo o que o saldo do mês precisa além dos registos: regras, feriados e ausências aprovadas
 * (de uma pessoa, ou de todas com `employeeId` null). Devolve `bankFor` para calcular o saldo
 * de cada pessoa a partir dos dias do ponto.
 */
export const useHourBank = (month: Date, employeeId: string | null, enabled = true) => {
  const from = format(startOfMonth(month), 'yyyy-MM-dd');
  const to = format(endOfMonth(month), 'yyyy-MM-dd');
  const settings = useHourBankSettings();
  const extra = useQuery({
    queryKey: ['timeclock', 'hour-bank', from, employeeId ?? 'all'],
    queryFn: async () => {
      const [absences, holidays] = await Promise.all([
        hourBankService.getAbsences(from, to, employeeId),
        holidayService.getRange(from, to),
      ]);
      if (absences.error) throw absences.error;
      return { absences: absences.data, holidays: holidays.data };
    },
    enabled,
    staleTime: 60_000,
  });

  const data = extra.data;
  const rules = settings.data ?? DEFAULT_HOUR_BANK;
  const bankFor = useCallback(
    (person: string, days: DaySummary[]): MonthBank | null => {
      if (!data) return null;
      const absences: BankAbsence[] = data.absences.filter(a => a.employee_id === person);
      return monthHourBank({
        month,
        today: new Date(),
        workedByDay: new Map(days.map(d => [d.date, d.workedMinutes])),
        absences,
        holidays: data.holidays,
        settings: rules,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o mês resume-se em `from`
    [data, rules, from]
  );

  return { bankFor, settings: rules, isLoading: extra.isLoading || settings.isLoading };
};
