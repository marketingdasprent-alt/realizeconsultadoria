import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { employeeProfileService } from '@/modules/employee/services/employeeProfileService';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from '@/modules/workspace/context/workspaceContext';

interface AdminWorkspaceBridgeProps {
  children: React.ReactNode;
  /** Quem está no admin não tem ficha de colaborador (sem ela não há tarefas nem colegas). */
  onMissing: () => void;
}

/**
 * Peças do Workspace (tarefas, escolher colegas) dentro do admin: carrega a ficha de
 * colaborador de quem está autenticado e dá-lhes o mesmo contexto que têm no Workspace.
 */
export const AdminWorkspaceBridge: React.FC<AdminWorkspaceBridgeProps> = ({
  children,
  onMissing,
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'workspace-user'],
    queryFn: async () => (await employeeProfileService.getCurrent()).data,
    staleTime: 10 * 60_000,
  });
  const employee = data?.employee;

  useEffect(() => {
    if (isLoading || employee?.user_id) return;
    toast({
      title: 'Sem ficha de colaborador',
      description: 'Para criar tarefas, a sua conta tem de estar ligada a um colaborador.',
      variant: 'destructive',
    });
    onMissing();
  }, [isLoading, employee, onMissing]);

  if (isLoading)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  if (!employee?.user_id) return null;

  const value: WorkspaceContextValue = {
    user: {
      userId: employee.user_id,
      employeeId: employee.id,
      companyId: employee.company_id,
      name: employee.name,
      email: employee.email || data?.email || '',
      position: employee.position,
      department: employee.department,
      companyName: employee.companies?.name ?? null,
      phone: employee.phone,
      hireDate: employee.hire_date,
    },
    basePath: '/colaborador',
    isPreview: false,
    onLogout: () => undefined,
    onChangePassword: () => undefined,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
