import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/lib/constants';
import ChangePasswordDialog from '@/components/employee/ChangePasswordDialog';
import type {
  EmployeeOutletContext,
  EmployeeProfile,
} from '@/modules/employee/hooks/useEmployeeOutlet';
import { employeeProfileService } from '@/modules/employee/services/employeeProfileService';
import { LiveMessengerProvider } from '@/modules/messenger/context/MessengerProvider';
import type { WorkspaceContextValue } from '../context/workspaceContext';
import { useRzTheme } from '../hooks/useRzTheme';
import { WorkspaceShell } from './shell/WorkspaceShell';

const FullScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-rz-aurora p-4 font-jakarta">
    {children}
  </div>
);

/**
 * Área do colaborador (Realize 2.0): carrega o colaborador autenticado e partilha-o
 * com as páginas (Outlet context, igual ao EmployeeLayout anterior) e com a estrutura.
 */
const WorkspaceLayout: React.FC = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  useRzTheme();

  const refresh = useCallback(async () => {
    const { data } = await employeeProfileService.getCurrent();
    if (!data) {
      navigate(ROUTES.EMPLOYEE.LOGIN);
      return;
    }
    setEmployee(data.employee);
    setSessionEmail(data.email);
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    navigate(standalone ? ROUTES.EMPLOYEE.LOGIN : ROUTES.PUBLIC.HOME);
  }, [navigate]);

  const workspace = useMemo<WorkspaceContextValue | null>(
    () =>
      employee && {
        user: {
          userId: employee.user_id ?? '',
          employeeId: employee.id,
          companyId: employee.company_id,
          name: employee.name,
          email: employee.email || sessionEmail,
          position: employee.position,
          department: employee.department,
          companyName: employee.companies?.name ?? null,
          phone: employee.phone,
          hireDate: employee.hire_date,
        },
        basePath: ROUTES.EMPLOYEE.DASHBOARD,
        isPreview: false,
        onLogout: handleLogout,
        onChangePassword: () => setIsChangePasswordOpen(true),
      },
    [employee, sessionEmail, handleLogout]
  );

  if (isLoading) {
    return (
      <FullScreen>
        <Loader2 className="h-8 w-8 animate-spin text-white/80" />
      </FullScreen>
    );
  }

  if (!employee || !workspace) {
    return (
      <FullScreen>
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-rz-pop">
          <p className="mb-5 text-[15px] text-slate-600">
            A sua conta ainda não está associada a uma empresa. Por favor contacte o administrador.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="h-11 rounded-full bg-violet-600 px-6 text-sm font-semibold text-white"
          >
            Terminar sessão
          </button>
        </div>
      </FullScreen>
    );
  }

  const context: EmployeeOutletContext = { employee, sessionEmail, refresh };

  return (
    // O Messenger fica acima da estrutura: as mensagens e os contadores do menu
    // atualizam-se em tempo real em qualquer página.
    <LiveMessengerProvider
      user={{
        userId: employee.user_id ?? '',
        companyId: employee.company_id,
        name: employee.name,
      }}
    >
      <WorkspaceShell value={workspace}>
        <Outlet context={context} />
        <ChangePasswordDialog
          open={isChangePasswordOpen}
          onOpenChange={setIsChangePasswordOpen}
          employeeEmail={sessionEmail}
        />
      </WorkspaceShell>
    </LiveMessengerProvider>
  );
};

export default WorkspaceLayout;
