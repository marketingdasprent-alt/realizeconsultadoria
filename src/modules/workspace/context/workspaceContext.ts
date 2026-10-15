// Contexto da área do colaborador (Realize 2.0): quem está autenticado, a base das
// rotas e as ações da conta. Fornecido pelo WorkspaceLayout (dados reais) ou pela
// pré-visualização de desenvolvimento (dados de exemplo).
import { createContext, useContext } from 'react';

export interface WorkspaceUser {
  /** Conta (auth.users) e ficha de colaborador. */
  userId: string;
  employeeId: string;
  companyId: string;
  name: string;
  email: string;
  position: string | null;
  department: string | null;
  companyName: string | null;
  phone: string | null;
  /** Data de admissão: só visível no próprio perfil. */
  hireDate: string | null;
}

export interface WorkspaceContextValue {
  user: WorkspaceUser;
  /** Base das rotas (/colaborador, ou /dev/realize-2 na pré-visualização). */
  basePath: string;
  /** Pré-visualização com dados de exemplo (sem sessão). */
  isPreview: boolean;
  onLogout: () => void;
  onChangePassword: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace tem de ser usado dentro do WorkspaceShell');
  return context;
};
