import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Remonta tudo o que está dentro quando muda a conta (ou quando se sai e entra outra). O estado
 * dos componentes (ficha, separadores, empresa escolhida, formulários…) é da conta que o criou:
 * sem isto, outra conta a entrar no mesmo separador herdava a identidade e o estado da anterior.
 */
export const RemountOnUserChange: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return <React.Fragment key={user?.id ?? 'sem-sessao'}>{children}</React.Fragment>;
};
