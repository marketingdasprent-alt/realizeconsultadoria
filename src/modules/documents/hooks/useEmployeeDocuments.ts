import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAYSLIP_CATEGORY, type EmployeeDocument } from '@/lib/documents';
import { documentService } from '../services/documentService';

interface UseEmployeeDocumentsResult {
  /** Documentos aprovados e atuais (exclui recibos). */
  current: EmployeeDocument[];
  /** Recibos de vencimento atuais, do mais recente para o mais antigo. */
  payslips: EmployeeDocument[];
  /** Tudo o que o colaborador submeteu (pendente, aprovado ou rejeitado). */
  submissions: EmployeeDocument[];
  /** Outros documentos aprovados não atuais (histórico da empresa). */
  archived: EmployeeDocument[];
  all: EmployeeDocument[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Documentos de um colaborador agrupados para o portal.
 */
export const useEmployeeDocuments = (employeeId: string | null): UseEmployeeDocumentsResult => {
  const [all, setAll] = useState<EmployeeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await documentService.listForEmployee(employeeId);
    if (fetchError) setError('Erro ao carregar os documentos');
    else setAll(data);
    setIsLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const grouped = useMemo(() => {
    const isPayslip = (d: EmployeeDocument) => d.category === PAYSLIP_CATEGORY;
    const approved = all.filter(d => d.status === 'approved');
    return {
      current: approved.filter(d => d.is_current && !isPayslip(d)),
      payslips: approved
        .filter(d => d.is_current && isPayslip(d))
        .sort((a, b) => (b.period_month ?? '').localeCompare(a.period_month ?? '')),
      submissions: all.filter(d => d.uploaded_by_role === 'employee'),
      archived: approved.filter(
        d => !d.is_current && !isPayslip(d) && d.uploaded_by_role !== 'employee'
      ),
    };
  }, [all]);

  return { ...grouped, all, isLoading, error, refetch: fetchDocuments };
};
