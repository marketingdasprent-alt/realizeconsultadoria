import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { companyMembershipService } from '../services/companyMembershipService';
import { adminCountOf, adminCountsByCompany, groupNameOf } from '../lib/companySummary';
import { groupOverview, managesCompany } from '../lib/sharing';
import { useAllGroups, useMyCompanies } from './useSharing';

export interface CompanyFacts {
  /** Nome do grupo (super admin) ou "Em grupo" (os outros); null se não está em nenhum. */
  group: string | null;
  /** Administradores da empresa; null se ainda carrega ou se a conta não pode saber. */
  admins: number | null;
}

/**
 * O que a lista de Empresas mostra além dos dados: o grupo e o nº de administradores de cada uma.
 * Duas consultas só, sem uma por empresa: os grupos (super admin) e as pertenças de administrador
 * (a base já só devolve as das empresas que a conta administra).
 */
export const useCompanyListFacts = (companyIds: readonly string[], isSuperAdmin: boolean) => {
  const mine = useMyCompanies();
  const groups = useAllGroups(isSuperAdmin);
  const memberships = useQuery({
    queryKey: ['admin', 'companies', 'admin-memberships'],
    queryFn: companyMembershipService.adminMemberships,
    staleTime: 60_000,
    retry: false,
  });
  const idsKey = companyIds.join(',');

  return useMemo(() => {
    const groupByCompany = new Map<string, string>();
    for (const group of groupOverview(groups.data ?? [])) {
      for (const member of group.members) groupByCompany.set(member.companyId, group.name);
    }
    const inGroup = new Set<string>();
    const administered = new Set<string>();
    for (const company of mine.data ?? []) {
      if (company.is_group_member) inGroup.add(company.company_id);
      if (managesCompany(company.role)) administered.add(company.company_id);
    }
    const counts = memberships.data ? adminCountsByCompany(memberships.data) : null;
    const facts = new Map<string, CompanyFacts>();
    for (const id of idsKey.split(',').filter(Boolean)) {
      facts.set(id, {
        group: groupNameOf(id, groupByCompany, isSuperAdmin, inGroup),
        admins: adminCountOf(id, counts, isSuperAdmin, administered),
      });
    }
    return facts;
  }, [idsKey, isSuperAdmin, groups.data, mine.data, memberships.data]);
};
