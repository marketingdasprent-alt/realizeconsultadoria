// src/components/ProtectedRoute.tsx
// Componente para proteger rotas que requerem autenticação e role específico

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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
  const { isLoading, isAuthenticated, role } = useAuth();
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

  // Se não está autenticado, redirecionar para login
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Se requer um role específico e não tem, redirecionar para a área correta
  if (requiredRole) {
    const rolesArray = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!role || !rolesArray.includes(role)) {
      // Redirecionar admin para /admin e employee para /colaborador
      const redirectTo = role === 'admin' ? '/admin' : role === 'employee' ? '/colaborador' : fallbackPath;
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
};
