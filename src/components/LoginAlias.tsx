import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';

/**
 * Endereços antigos do login (/admin/login, /colaborador/login): agora há um login só, na página
 * inicial. Mantém o "de onde vinha" para voltar lá depois de entrar.
 */
export const LoginAlias: React.FC = () => {
  const location = useLocation();
  return <Navigate to={ROUTES.AUTH.LOGIN} replace state={location.state} />;
};
