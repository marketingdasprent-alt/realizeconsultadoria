import { useCallback, useEffect, useState } from 'react';
import { documentService, type EmployeeDocumentWithEmployee } from '../services/documentService';

interface UsePayslipMonthResult {
  /** Recibo atual por employee_id. */
  byEmployee: Record<string, EmployeeDocumentWithEmployee>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Recibos de vencimento já importados para um mês (yyyy-MM-01).
 */
export const usePayslipMonth = (periodMonth: string): UsePayslipMonthResult => {
  const [byEmployee, setByEmployee] = useState<Record<string, EmployeeDocumentWithEmployee>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await documentService.listPayslipsForMonth(periodMonth);
    if (fetchError) setError('Erro ao carregar recibos');
    else setByEmployee(Object.fromEntries(data.map(d => [d.employee_id, d])));
    setIsLoading(false);
  }, [periodMonth]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  return { byEmployee, isLoading, error, refetch: fetchMonth };
};
