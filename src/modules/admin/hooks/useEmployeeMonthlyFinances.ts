import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  employeeFinanceService,
  sumDiscountItems,
  DEFAULT_TAXA_KM,
  type DiscountItem,
  type EmployeeMonthlyFinance,
  type FinanceFields,
} from '@/modules/admin/services/employeeFinanceService';

type EditableNumberField =
  | 'valor_recebido'
  | 'valor_subsidio_alimentacao'
  | 'valor_cartao_da'
  | 'km_extras'
  | 'taxa_km';

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
    field: EditableNumberField,
    value: number
  ) => Promise<{ success: boolean; error?: string }>;
  addDiscountItem: (
    employeeId: string,
    payload: { category: string; description: string | null; amount: number }
  ) => Promise<{ success: boolean; error?: string }>;
  removeDiscountItem: (
    employeeId: string,
    itemId: string
  ) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

const emptyFinance = (): FinanceFields => ({
  valor_recebido: 0,
  valor_subsidio_alimentacao: 0,
  valor_cartao_da: 0,
  valor_descontado: 0,
  km_extras: 0,
  taxa_km: DEFAULT_TAXA_KM,
  discount_items: [],
});

const toFields = (row: EmployeeMonthlyFinance): FinanceFields => {
  const rawItems = Array.isArray(row.discount_items) ? (row.discount_items as unknown[]) : [];
  const items: DiscountItem[] = rawItems
    .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
    .map(it => ({
      id: String(it.id ?? crypto.randomUUID()),
      category: String(it.category ?? 'outro'),
      description: it.description == null ? null : String(it.description),
      amount: Number(it.amount) || 0,
    }));
  const rowTaxa = Number(row.taxa_km);
  return {
    valor_recebido: Number(row.valor_recebido) || 0,
    valor_subsidio_alimentacao: Number(row.valor_subsidio_alimentacao) || 0,
    valor_cartao_da: Number(row.valor_cartao_da) || 0,
    valor_descontado: Number(row.valor_descontado) || 0,
    km_extras: Number(row.km_extras) || 0,
    taxa_km: Number.isFinite(rowTaxa) && rowTaxa > 0 ? rowTaxa : DEFAULT_TAXA_KM,
    discount_items: items,
  };
};

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

  const persist = useCallback(
    async (employeeId: string, next: FinanceFields, previous: FinanceFields) => {
      setFinances(prev => ({ ...prev, [employeeId]: next }));
      const { error: upsertError } = await employeeFinanceService.upsert(
        employeeId,
        year,
        month,
        next
      );
      if (upsertError) {
        setFinances(prev => ({ ...prev, [employeeId]: previous }));
        const message =
          upsertError instanceof Error ? upsertError.message : 'Erro ao guardar valor.';
        return { success: false, error: message };
      }
      return { success: true };
    },
    [year, month]
  );

  const updateField = useCallback(
    async (employeeId: string, field: EditableNumberField, value: number) => {
      const previous = finances[employeeId] ?? emptyFinance();
      const next: FinanceFields = { ...previous, [field]: value };
      return persist(employeeId, next, previous);
    },
    [finances, persist]
  );

  const addDiscountItem = useCallback(
    async (
      employeeId: string,
      payload: { category: string; description: string | null; amount: number }
    ) => {
      const previous = finances[employeeId] ?? emptyFinance();
      const newItem: DiscountItem = {
        id: crypto.randomUUID(),
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
      };
      const nextItems = [...previous.discount_items, newItem];
      const next: FinanceFields = {
        ...previous,
        discount_items: nextItems,
        valor_descontado: sumDiscountItems(nextItems),
      };
      return persist(employeeId, next, previous);
    },
    [finances, persist]
  );

  const removeDiscountItem = useCallback(
    async (employeeId: string, itemId: string) => {
      const previous = finances[employeeId] ?? emptyFinance();
      const nextItems = previous.discount_items.filter(it => it.id !== itemId);
      const next: FinanceFields = {
        ...previous,
        discount_items: nextItems,
        valor_descontado: sumDiscountItems(nextItems),
      };
      return persist(employeeId, next, previous);
    },
    [finances, persist]
  );

  return useMemo(
    () => ({
      finances,
      isLoading,
      error,
      updateField,
      addDiscountItem,
      removeDiscountItem,
      refetch: fetchData,
    }),
    [finances, isLoading, error, updateField, addDiscountItem, removeDiscountItem, fetchData]
  );
};
