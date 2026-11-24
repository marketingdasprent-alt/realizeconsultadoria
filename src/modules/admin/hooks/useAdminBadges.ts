import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@/lib/constants';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { badgeService } from '../services/badgeService';

/**
 * Números do menu do admin, por página: documentos por aprovar (Colaboradores), pedidos
 * pendentes (Férias e Ausências) e tickets abertos (Suporte), só da empresa ou do grupo escolhido
 * no menu. Atualiza a cada minuto e ao voltar à janela.
 */
export const useAdminBadges = (): Record<string, number> => {
  const { ids, isLoading: scopeLoading } = useCompanyScope();
  // Chave pelas empresas da escolha (num grupo, os membros podem mudar sem o nome do grupo mudar).
  const scopeKey = ids ? [...ids].sort().join(',') : 'all';
  const { data } = useQuery({
    // 'badges' fica na chave: depois de aprovar um documento invalida-se por este prefixo.
    queryKey: ['admin', 'badges', scopeKey],
    enabled: !scopeLoading,
    queryFn: async () => {
      const { data: counts, error } = await badgeService.counts(ids ? [...ids] : null);
      if (error || !counts) throw error ?? new Error('Sem contagens');
      return counts;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return {
    [ROUTES.ADMIN.EMPLOYEES]: data?.pendingDocuments ?? 0,
    [ROUTES.ADMIN.CALENDAR]: data?.pendingRequests ?? 0,
    [ROUTES.ADMIN.SUPPORT]: data?.openTickets ?? 0,
  };
};
