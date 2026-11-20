import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  clearDeviceCache,
  readDeviceCache,
  sessionUserId,
  sessionChangedSince,
  writeDeviceCacheIfSession,
} from '@/lib/device-cache';
import { resetCompanyScopedQueries, shouldResetCompanyQueries } from '@/lib/query-persist';
import { clearMailCache } from '@/modules/webmail/lib/mailCache';
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

const USER_CACHE = 'workspace-user';

const toUser = (
  employee: EmployeeProfile,
  sessionEmail: string
): WorkspaceContextValue['user'] => ({
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
});

/** Enquanto o código de uma página chega (só da primeira vez). */
const PageLoading: React.FC = () => (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-7 w-7 animate-spin text-rz-primary" />
  </div>
);

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
  // O utilizador da última vez (só o que a estrutura mostra): a app abre já com ele e a ficha
  // completa chega em segundo plano.
  const [cachedUser] = useState(() =>
    readDeviceCache<WorkspaceContextValue['user']>(USER_CACHE, sessionUserId())
  );
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const queryClient = useQueryClient();
  // Empresa da ficha da última vez: se mudou, a cache de conversas, Feed… é da empresa anterior.
  const knownCompanyId = useRef<string | null>(cachedUser?.companyId ?? null);
  useRzTheme();

  const refresh = useCallback(async () => {
    // Quem pediu: se a conta mudar durante o pedido, a ficha não vai para a cache da nova.
    const requester = sessionUserId();
    const { data } = await employeeProfileService.getCurrent();
    // A conta mudou durante o pedido: a resposta é da conta anterior.
    if (sessionChangedSince(requester)) return;
    if (!data) {
      navigate(ROUTES.EMPLOYEE.LOGIN);
      return;
    }
    const companyId = data.employee?.company_id ?? null;
    if (shouldResetCompanyQueries(knownCompanyId.current, companyId)) {
      void resetCompanyScopedQueries(queryClient);
    }
    if (companyId) knownCompanyId.current = companyId;
    setEmployee(data.employee);
    setSessionEmail(data.email);
    setIsLoading(false);
    if (data.employee)
      writeDeviceCacheIfSession(USER_CACHE, requester, toUser(data.employee, data.email));
  }, [navigate, queryClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    clearMailCache();
    clearDeviceCache();
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    navigate(standalone ? ROUTES.EMPLOYEE.LOGIN : ROUTES.PUBLIC.HOME);
  }, [navigate]);

  const user = employee ? toUser(employee, sessionEmail) : cachedUser;
  const workspace = useMemo<WorkspaceContextValue | null>(
    () =>
      user && {
        user,
        basePath: ROUTES.EMPLOYEE.DASHBOARD,
        isPreview: false,
        onLogout: handleLogout,
        onChangePassword: () => setIsChangePasswordOpen(true),
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user deriva de employee/cachedUser
    [employee, sessionEmail, cachedUser, handleLogout]
  );

  if (isLoading && !workspace) {
    return (
      <FullScreen>
        <Loader2 className="h-8 w-8 animate-spin text-white/80" />
      </FullScreen>
    );
  }

  if (!workspace || (!isLoading && !employee)) {
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
        userId: workspace.user.userId,
        companyId: workspace.user.companyId,
        name: workspace.user.name,
      }}
    >
      <WorkspaceShell value={workspace}>
        <Suspense fallback={<PageLoading />}>
          <Outlet context={context} />
        </Suspense>
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
