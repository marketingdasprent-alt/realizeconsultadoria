import { useOutletContext } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

export type EmployeeProfile = Database['public']['Tables']['employees']['Row'] & {
  companies: { name: string } | null;
};

export interface EmployeeOutletContext {
  /** null por instantes ao abrir (a app desenha já com o utilizador guardado no aparelho). */
  employee: EmployeeProfile | null;
  sessionEmail: string;
  refresh: () => Promise<void>;
}

/** Colaborador autenticado, fornecido pelo WorkspaceLayout às páginas filhas. */
export const useEmployeeOutlet = (): EmployeeOutletContext =>
  useOutletContext<EmployeeOutletContext>();
