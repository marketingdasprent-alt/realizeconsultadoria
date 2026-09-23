import { useOutletContext } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

export type EmployeeProfile = Database['public']['Tables']['employees']['Row'] & {
  companies: { name: string } | null;
};

export interface EmployeeOutletContext {
  employee: EmployeeProfile;
  sessionEmail: string;
  refresh: () => Promise<void>;
}

/** Colaborador autenticado, fornecido pelo EmployeeLayout às páginas filhas. */
export const useEmployeeOutlet = (): EmployeeOutletContext =>
  useOutletContext<EmployeeOutletContext>();
