import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardOverview } from '../services/dashboardService';

/** Números e ausentes de hoje do Dashboard (em cache: voltar ao Dashboard é imediato). */
export const useDashboardOverview = () =>
  useQuery<DashboardOverview>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data, error } = await dashboardService.getOverview();
      if (error || !data) throw error ?? new Error('Sem dados do dashboard');
      return data;
    },
    staleTime: 60_000,
  });
