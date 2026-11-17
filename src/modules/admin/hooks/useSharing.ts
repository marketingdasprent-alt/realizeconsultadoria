import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sharingService } from '../services/sharingService';
import type { RequestDirection } from '../lib/sharing';

const KEY = ['admin', 'sharing'] as const;

/** Não repetir o pedido quando a função ainda não existe ou a pessoa não tem direito. */
const retryTransient = (count: number, error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'unavailable' || code === 'forbidden' || code === 'not_company_admin') return false;
  return count < 2;
};

export const useMyCompanies = () =>
  useQuery({
    queryKey: [...KEY, 'companies'],
    queryFn: sharingService.myCompanies,
    // As empresas de que se é admin mudam quando alguém dá o acesso: ao abrir a página, ler sempre
    // de novo (senão um "vazio" de há minutos ficava a valer).
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: retryTransient,
  });

export const useCompanyViewers = (company: string) =>
  useQuery({
    queryKey: [...KEY, 'viewers', company],
    queryFn: () => sharingService.companyViewers(company),
    retry: retryTransient,
  });

export const useAllGroups = (enabled: boolean) =>
  useQuery({
    queryKey: [...KEY, 'all-groups'],
    queryFn: sharingService.listAllGroups,
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: retryTransient,
  });

export const useCapabilities = () =>
  useQuery({
    queryKey: [...KEY, 'capabilities'],
    queryFn: sharingService.capabilities,
    staleTime: 30 * 60_000,
    retry: retryTransient,
  });

export const useShareCode = (company: string) =>
  useQuery({
    queryKey: [...KEY, 'code', company],
    queryFn: () => sharingService.getShareCode(company),
    retry: retryTransient,
  });

export const useShareRequests = (company: string, direction: RequestDirection) =>
  useQuery({
    queryKey: [...KEY, 'requests', company, direction],
    queryFn: () => sharingService.listRequests(company, direction),
    retry: retryTransient,
  });

export const useShares = (company: string, includeRevoked: boolean) =>
  useQuery({
    queryKey: [...KEY, 'shares', company, includeRevoked],
    queryFn: () => sharingService.listShares(company, includeRevoked),
    retry: retryTransient,
  });

export const useGroup = (company: string) =>
  useQuery({
    queryKey: [...KEY, 'group', company],
    queryFn: () => sharingService.listGroup(company),
    retry: retryTransient,
  });

/** Depois de uma escrita, tudo o que depende das partilhas volta a ser lido. */
export const useRefreshSharing = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
};
