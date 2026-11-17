import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAllGroups } from '../hooks/useSharing';
import { groupOverview } from '../lib/sharing';
import {
  SCOPE_ALL,
  SCOPE_STORAGE_KEY,
  hasScopeChoice,
  scopeCompanyIds,
  scopeGroups,
  scopeLabel,
  validScope,
  type ScopeCompany,
  type ScopeGroup,
} from '../lib/companyScope';

/** Empresas ativas que a conta vê (a base já limita as de cada admin). */
export const useActiveCompanies = () =>
  useQuery({
    queryKey: ['admin', 'companies-active'],
    queryFn: async (): Promise<ScopeCompany[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

interface CompanyScopeValue {
  /** A escolha tal como está guardada: 'all', 'c:<id>' ou 'g:<id>'. */
  scope: string;
  setScope: (scope: string) => void;
  companies: ScopeCompany[];
  groups: ScopeGroup[];
  /** As empresas escolhidas, ou null para "Todas" (sem limite). */
  ids: Set<string> | null;
  /** O nome da escolha. */
  label: string;
  /** Há mais de uma empresa para escolher (senão o seletor nem aparece). */
  hasChoice: boolean;
  /** Se a escolha é uma só empresa, o id dela. */
  singleCompanyId: string | null;
  isLoading: boolean;
}

const CompanyScopeContext = createContext<CompanyScopeValue | null>(null);

const readStored = (): string => {
  try {
    return window.localStorage.getItem(SCOPE_STORAGE_KEY) ?? SCOPE_ALL;
  } catch {
    return SCOPE_ALL;
  }
};

export const CompanyScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin } = useAdminPermissions();
  const companiesQuery = useActiveCompanies();
  const groupsQuery = useAllGroups(isSuperAdmin);
  const [stored, setStored] = useState(readStored);

  const companies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data]);
  const groups = useMemo(
    () => scopeGroups(groupOverview(groupsQuery.data ?? [])),
    [groupsQuery.data]
  );

  // Enquanto as empresas carregam, a escolha guardada vale; depois só se ainda existir.
  const loaded = !companiesQuery.isLoading && !groupsQuery.isLoading;
  const scope = loaded ? validScope(stored, companies, groups) : stored;

  const setScope = useCallback((next: string) => {
    setStored(next);
    try {
      window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      // Sem armazenamento (modo privado): fica só nesta sessão.
    }
  }, []);

  const value = useMemo<CompanyScopeValue>(() => {
    const ids = loaded ? scopeCompanyIds(scope, companies, groups) : null;
    return {
      scope,
      setScope,
      companies,
      groups,
      ids,
      label: scopeLabel(scope, companies, groups),
      hasChoice: hasScopeChoice(companies),
      singleCompanyId: scope.startsWith('c:') ? scope.slice(2) : null,
      isLoading: !loaded,
    };
  }, [scope, setScope, companies, groups, loaded]);

  return <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>;
};

const NO_SCOPE: CompanyScopeValue = {
  scope: SCOPE_ALL,
  setScope: () => undefined,
  companies: [],
  groups: [],
  ids: null,
  label: 'Todas as empresas',
  hasChoice: false,
  singleCompanyId: null,
  isLoading: false,
};

/** A empresa ou grupo escolhido no menu. Fora do admin não limita nada. */
export const useCompanyScope = (): CompanyScopeValue => useContext(CompanyScopeContext) ?? NO_SCOPE;
