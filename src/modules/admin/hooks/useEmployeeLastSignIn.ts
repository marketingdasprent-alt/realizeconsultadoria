import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { accessStatus, type AccessStatus } from '../lib/accessStatus';

/** Última entrada na app de cada colaborador (só para administradores). */
export const useEmployeeLastSignIn = () => {
  const query = useQuery({
    queryKey: ['admin', 'employee-last-sign-in'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_employee_last_sign_in');
      if (error) throw error;
      return new Map((data ?? []).map(row => [row.employee_id, row.last_sign_in_at]));
    },
    staleTime: 5 * 60_000,
  });
  const loaded = !!query.data;
  /** null enquanto não chega (não se marca ninguém por engano). */
  const accessOf = useCallback(
    (employeeId: string): AccessStatus | null =>
      loaded ? accessStatus(query.data?.get(employeeId) ?? null) : null,
    [loaded, query.data]
  );
  return { accessOf };
};
