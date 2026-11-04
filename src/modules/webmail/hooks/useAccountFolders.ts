import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mailService } from '../services/mailService';

/** Pastas da pessoa numa caixa (a mesma consulta da barra lateral, por isso sem pedidos a mais). */
export const useAccountFolders = (accountId: string | null) => {
  const { isPreview } = useWorkspace();
  return useQuery({
    queryKey: ['mail', 'folders', accountId],
    enabled: !!accountId && !isPreview,
    queryFn: async () => {
      const { data, error } = await mailService.folders(accountId ?? '');
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60_000,
    retry: 1,
  });
};
