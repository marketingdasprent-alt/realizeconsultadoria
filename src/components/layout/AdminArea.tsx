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

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/**
 * Área de administração (/admin/…). Quem entra com a conta de colaborador e é administrador
 * (conta unificada) vê as páginas do admin dentro do Workspace, com o mesmo menu (secção
 * Gestão). As contas só de admin continuam no painel de administração de sempre.
 */
export const AdminArea: React.FC = () => {
  const { role, isLoading, isAuthenticated } = useAuth();
  const access = useAdminAccess();
  const location = useLocation();

  if (isLoading) return <Loading />;
  if (!isAuthenticated)
    return <Navigate to={ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  if (role === 'employee') {
    if (access.isLoading) return <Loading />;
    if (!access.isAdmin) return <Navigate to={ROUTES.EMPLOYEE.DASHBOARD} replace />;
    return (
      <WorkdayProvider>
        <WorkspaceLayout />
      </WorkdayProvider>
    );
  }
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout />
    </ProtectedRoute>
  );
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
