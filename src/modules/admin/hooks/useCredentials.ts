import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { filterByScope } from '../lib/companyScope';
import { credentialService, type CredentialsData } from '../services/credentialService';

export const CREDENTIALS_KEY = ['admin', 'credentials'] as const;

const EMPTY: CredentialsData = {
  credentials: [],
  categories: [],
  companies: [],
  employees: [],
  shares: new Map(),
  mailboxes: new Map(),
};

/** Tudo o que as abas Emails e Acessos mostram, num só pedido em cache. */
export const useCredentials = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CREDENTIALS_KEY,
    queryFn: async () => {
      const { data, error } = await credentialService.load();
      if (error || !data) throw error ?? new Error('Sem acessos');
      return data;
    },
    staleTime: 30_000,
  });
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: CREDENTIALS_KEY }),
    [queryClient]
  );
  return {
    ...(query.data ?? EMPTY),
    isLoading: query.isLoading,
    isError: query.isError,
    refresh,
  };
};

/** Os acessos e emails só da empresa ou grupo escolhido no menu (as abas Emails e Acessos). */
export const useScopedCredentials = () => {
  const data = useCredentials();
  const { ids } = useCompanyScope();
  return useMemo(
    () => ({
      ...data,
      credentials: filterByScope(data.credentials, ids, c => c.company_id),
      employees: filterByScope(data.employees, ids, e => e.company_id),
      companies: filterByScope(data.companies, ids, c => c.id),
    }),
    [data, ids]
  );
};
