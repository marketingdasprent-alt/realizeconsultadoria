import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EXPIRY_WARNING_DAYS } from '@/lib/documents';
import {
  documentService,
  type EmployeeDocumentWithEmployee,
} from '@/modules/documents/services/documentService';
import { isReviewable } from '@/modules/documents/lib/registration';

const group = (docs: EmployeeDocumentWithEmployee[]) => {
  const byEmployee = new Map<string, EmployeeDocumentWithEmployee[]>();
  for (const doc of docs)
    byEmployee.set(doc.employee_id, [...(byEmployee.get(doc.employee_id) ?? []), doc]);
  return byEmployee;
};

/**
 * Documentos que pedem atenção na lista de colaboradores: os enviados à espera de aprovação
 * e os que expiram nos próximos 60 dias (ou já expiraram), agrupados por colaborador.
 */
export const useDocumentAlerts = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'document-alerts'],
    queryFn: async () => {
      const [pending, expiring] = await Promise.all([
        documentService.listPending(),
        documentService.listExpiring(EXPIRY_WARNING_DAYS),
      ]);
      if (pending.error) throw pending.error;
      if (expiring.error) throw expiring.error;
      // Só os documentos de registo (ou ainda sem tipo) pedem aprovação.
      return { pending: pending.data.filter(isReviewable), expiring: expiring.data };
    },
    staleTime: 30_000,
  });

  const pending = useMemo(() => query.data?.pending ?? [], [query.data]);
  const expiring = useMemo(() => query.data?.expiring ?? [], [query.data]);
  const pendingBy = useMemo(() => group(pending), [pending]);
  const expiringBy = useMemo(() => group(expiring), [expiring]);

  return {
    pending,
    expiring,
    pendingOf: (employeeId: string) => pendingBy.get(employeeId) ?? [],
    expiringOf: (employeeId: string) => expiringBy.get(employeeId) ?? [],
    // Depois de aprovar ou rejeitar, os números do menu também mudam já.
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] });
      return query.refetch();
    },
  };
};
