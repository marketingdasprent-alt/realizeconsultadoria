// src/components/ProtectedRoute.tsx
// Componente para proteger rotas que requerem autenticação e role específico

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ServiceUnavailableNotice } from '@/components/ServiceUnavailableNotice';
import { OtherAreaRedirect } from '@/components/OtherAreaRedirect';
import type { SwitchTarget } from '@/lib/account-switch';
import { accountSwitchService } from '@/modules/auth/services/accountSwitchService';

const areaOf = (roles: UserRole[]): SwitchTarget | null =>
  roles.includes('admin') ? 'admin' : roles.includes('employee') ? 'workspace' : null;

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallbackPath = '/admin/login',
}) => {
  const { isLoading, isAuthenticated, isServiceUnavailable, role } = useAuth();
  const location = useLocation();

  // Enquanto está carregando, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // A BD não respondeu ao ler o papel: esperar aqui (o AuthContext tenta de novo) em vez de
  // mandar para o login, que voltava a mandar para aqui e os dois entravam em ciclo.
  if (!isAuthenticated && isServiceUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <ServiceUnavailableNotice className="max-w-sm" />
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Se requer um role específico e não tem, redirecionar para a área correta
  if (requiredRole) {
    const rolesArray = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Login único: a área desta conta (ou desta página) pode estar no outro endereço
    // (admin.realizeconsultadoria.pt ↔ app.realizeconsultadoria.pt) — leva-se a sessão.
    const fits = !!role && rolesArray.includes(role);
    const area = fits ? areaOf(rolesArray) : role ? areaOf([role]) : null;
    if (area && accountSwitchService.needsSwitch(area)) return <OtherAreaRedirect to={area} />;
    if (!fits) {
      // Redirecionar admin para /admin e employee para /colaborador
      const redirectTo =
        role === 'admin' ? '/admin' : role === 'employee' ? '/colaborador' : fallbackPath;
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
};
