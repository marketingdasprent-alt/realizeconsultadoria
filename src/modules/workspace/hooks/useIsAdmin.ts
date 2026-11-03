import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { accountSwitchService } from '@/modules/auth/services/accountSwitchService';

/**
 * A pessoa é administradora: tem acesso à área de admin, pela conta com que entrou ou pela conta
 * de admin ligada à ficha. Serve para mostrar opções de admin no Workspace (a função do servidor
 * volta a verificar sempre).
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuth();
  const { data: targets = [] } = useQuery({
    queryKey: ['auth', 'switch-targets', user?.id],
    queryFn: async () => (await accountSwitchService.targets()).data,
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
  });
  return targets.includes('admin');
};
