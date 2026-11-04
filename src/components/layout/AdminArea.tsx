import React, { Suspense, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PrintPreviewHost } from '@/components/admin/PrintPreviewHost';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/lib/constants';
import { WorkdayProvider } from '@/modules/timeclock/context/WorkdayProvider';
import WorkspaceLayout from '@/modules/workspace/components/WorkspaceLayout';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useAdminAccess } from '@/modules/workspace/hooks/useIsAdmin';
import AdminLayout from './AdminLayout';
import './admin-theme.css';

const ShellByRole: React.FC = () => {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const inAdmin = pathname === ROUTES.ADMIN.DASHBOARD || pathname.startsWith('/admin/');

  // Colaborador (também com a conta de admin ligada): o Workspace, sempre o mesmo, para o
  // /colaborador/… e o /admin/… (o menu e as mensagens não se voltam a montar)
  if (role === 'employee')
    return (
      <WorkdayProvider>
        <WorkspaceLayout />
      </WorkdayProvider>
    );
  // Conta só de admin: o painel de administração (no Workspace não tem ficha de colaborador)
  if (role === 'admin')
    return inAdmin ? <AdminLayout /> : <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
};

/**
 * Estrutura única das áreas com sessão (/colaborador/… e /admin/…): a sessão valida-se uma vez
 * e a estrutura certa (Workspace ou painel de admin) fica montada enquanto se navega.
 */
export const AppShell: React.FC = () => (
  <ProtectedRoute>
    <ShellByRole />
  </ProtectedRoute>
);

/**
 * Páginas do admin: as contas só de admin passam; os colaboradores só se forem administradores
 * (conta unificada) — os outros voltam ao Workspace. O servidor volta a verificar tudo (RLS).
 */
export const AdminGate: React.FC = () => {
  const { role } = useAuth();
  const access = useAdminAccess();
  if (role === 'admin') return <Outlet />;
  if (access.isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-rz-primary" />
      </div>
    );
  return access.isAdmin ? <Outlet /> : <Navigate to={ROUTES.EMPLOYEE.DASHBOARD} replace />;
};

/**
 * /admin/ponto: no Workspace o ponto da equipa está na página Ponto (mesmos separadores e o
 * mesmo ?tab=, ex.: o link "revisao" dos emails); no painel de administração fica a página dele.
 */
export const AdminTimeClockRoute: React.FC<{ page: React.ReactElement }> = ({ page }) => {
  const { role } = useAuth();
  const { search } = useLocation();
  if (role !== 'employee') return page;
  const tab = new URLSearchParams(search).get('tab') || 'hoje';
  return <Navigate to={`${ROUTES.EMPLOYEE.TIMECLOCK}?tab=${encodeURIComponent(tab)}`} replace />;
};

/**
 * Moldura das páginas do admin: dentro do Workspace dá-lhes o deslocamento, as margens e os
 * retoques visuais do admin; no painel de administração (que já os tem) não faz nada.
 */
export const AdminPageFrame: React.FC = () => {
  const { role } = useAuth();
  const inWorkspace = role === 'employee';

  useEffect(() => {
    if (!inWorkspace) return;
    document.documentElement.classList.add('rz-admin');
    return () => document.documentElement.classList.remove('rz-admin');
  }, [inWorkspace]);

  if (!inWorkspace) return <Outlet />;
  return (
    <WorkspacePage width="full" className="max-w-[1600px]">
      <Suspense
        fallback={<div className="py-16 text-center text-sm text-rz-muted">A carregar…</div>}
      >
        <Outlet />
      </Suspense>
      <PrintPreviewHost />
    </WorkspacePage>
  );
};
