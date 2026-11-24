import { useQuery } from '@tanstack/react-query';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { dashboardService, type DashboardOverview } from '../services/dashboardService';

/**
 * Números e ausentes de hoje do Dashboard, só da empresa ou do grupo escolhido no menu (em
 * cache por escolha: voltar ao Dashboard é imediato).
 */
export const useDashboardOverview = () => {
  const { ids, isLoading: scopeLoading } = useCompanyScope();
  // Chave pelas empresas da escolha (num grupo, os membros podem mudar sem o nome do grupo mudar).
  const scopeKey = ids ? [...ids].sort().join(',') : 'all';
  return useQuery<DashboardOverview>({
    queryKey: ['admin', 'dashboard', scopeKey],
    // Sem esperar pela escolha, o Dashboard mostrava o total por um instante.
    enabled: !scopeLoading,
    queryFn: async () => {
      const { data, error } = await dashboardService.getOverview(ids ? [...ids] : null);
      if (error || !data) throw error ?? new Error('Sem dados do dashboard');
      return data;
    },
    staleTime: 60_000,
  });
};
