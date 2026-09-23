import { useCallback, useEffect, useState } from 'react';
import { EXPIRY_WARNING_DAYS } from '@/lib/documents';
import { documentService, type EmployeeDocumentWithEmployee } from '../services/documentService';

interface UseDocumentReviewResult {
  pending: EmployeeDocumentWithEmployee[];
  expiring: EmployeeDocumentWithEmployee[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fila de aprovação e documentos a expirar (BackOffice).
 */
export const useDocumentReview = (): UseDocumentReviewResult => {
  const [pending, setPending] = useState<EmployeeDocumentWithEmployee[]>([]);
  const [expiring, setExpiring] = useState<EmployeeDocumentWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [pendingRes, expiringRes] = await Promise.all([
      documentService.listPending(),
      documentService.listExpiring(EXPIRY_WARNING_DAYS),
    ]);
    if (pendingRes.error || expiringRes.error) setError('Erro ao carregar documentos');
    setPending(pendingRes.data);
    setExpiring(expiringRes.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { pending, expiring, isLoading, error, refetch: fetchAll };
};
