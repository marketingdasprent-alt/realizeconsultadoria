import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  employeeFinanceService,
  type EmployeeMonthlyFinance,
  type FinanceFields,
} from '@/modules/admin/services/employeeFinanceService';

export interface FinanceByEmployeeId {
  [employeeId: string]: FinanceFields;
}

interface UseEmployeeMonthlyFinancesResult {
  finances: FinanceByEmployeeId;
  isLoading: boolean;
  error: string | null;
  /**
   * Upserts a single field for an employee in the active period and updates
   * local state optimistically. Reverts on failure.
   */
  updateField: (
    employeeId: string,
    field: keyof FinanceFields,
    value: number
  ) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

const emptyFinance = (): FinanceFields => ({
  valor_recebido: 0,
  valor_subsidio_alimentacao: 0,
  valor_cartao_da: 0,
  valor_descontado: 0,
});

const toFields = (row: EmployeeMonthlyFinance): FinanceFields => ({
  valor_recebido: Number(row.valor_recebido) || 0,
  valor_subsidio_alimentacao: Number(row.valor_subsidio_alimentacao) || 0,
  valor_cartao_da: Number(row.valor_cartao_da) || 0,
  valor_descontado: Number(row.valor_descontado) || 0,
});

export const useEmployeeMonthlyFinances = (
  year: number,
  month: number
): UseEmployeeMonthlyFinancesResult => {
  const [finances, setFinances] = useState<FinanceByEmployeeId>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await employeeFinanceService.listByPeriod(year, month);
    if (fetchError) {
      setError('Erro ao carregar valores financeiros.');
      setFinances({});
      setIsLoading(false);
      return;
    }
    const map: FinanceByEmployeeId = {};
    data.forEach(row => {
      map[row.employee_id] = toFields(row);
    });
    setFinances(map);
    setIsLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateField = useCallback(
    async (employeeId: string, field: keyof FinanceFields, value: number) => {
      const previous = finances[employeeId] ?? emptyFinance();
      const next: FinanceFields = { ...previous, [field]: value };

      // Optimistic update
      setFinances(prev => ({ ...prev, [employeeId]: next }));

      const { error: upsertError } = await employeeFinanceService.upsert(
        employeeId,
        year,
        month,
        next
      );

      if (upsertError) {
        // Revert
        setFinances(prev => ({ ...prev, [employeeId]: previous }));
        const message =
          upsertError instanceof Error ? upsertError.message : 'Erro ao guardar valor.';
        return { success: false, error: message };
      }
      return { success: true };
    },
    [finances, year, month]
  );

  return useMemo(
    () => ({ finances, isLoading, error, updateField, refetch: fetchData }),
    [finances, isLoading, error, updateField, fetchData]
  );
};
