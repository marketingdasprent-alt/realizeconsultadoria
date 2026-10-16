import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@/lib/constants';
import { badgeService } from '../services/badgeService';

/**
 * Números do menu do admin, por página: documentos por aprovar (Colaboradores), pedidos
 * pendentes (Pedidos) e tickets abertos (Suporte). Atualiza a cada minuto e ao voltar à janela.
 */
export const useAdminBadges = (): Record<string, number> => {
  const { data } = useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: async () => {
      const { data: counts, error } = await badgeService.counts();
      if (error || !counts) throw error ?? new Error('Sem contagens');
      return counts;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return {
    [ROUTES.ADMIN.EMPLOYEES]: data?.pendingDocuments ?? 0,
    [ROUTES.ADMIN.REQUESTS]: data?.pendingRequests ?? 0,
    [ROUTES.ADMIN.SUPPORT]: data?.openTickets ?? 0,
  };
};
