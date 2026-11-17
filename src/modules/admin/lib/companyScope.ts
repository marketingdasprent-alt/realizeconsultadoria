// Empresa (ou grupo) escolhida no topo do menu do admin. Cada ecrã mostra só o que pertence a
// ela. A escolha é um texto simples: 'all', 'c:<id da empresa>' ou 'g:<id do grupo>'.
import { companyLabel, sortCompanies } from '@/lib/companyName';

export const SCOPE_ALL = 'all';
export const SCOPE_STORAGE_KEY = 'rz.admin.company-scope';

export interface ScopeCompany {
  id: string;
  name: string;
}

export interface ScopeGroup {
  id: string;
  name: string;
  /** Ids das empresas do grupo. */
  companyIds: string[];
}

export const companyScope = (companyId: string) => `c:${companyId}`;
export const groupScope = (groupId: string) => `g:${groupId}`;

/**
 * A escolha só vale se a empresa ou o grupo ainda existirem (ou 'all'). Uma empresa que deixou
 * de existir, ou uma escolha guardada por outra conta, volta a "Todas as empresas".
 */
export const validScope = (
  raw: string | null | undefined,
  companies: readonly ScopeCompany[],
  groups: readonly ScopeGroup[]
): string => {
  if (!raw || raw === SCOPE_ALL) return SCOPE_ALL;
  if (raw.startsWith('c:') && companies.some(c => c.id === raw.slice(2))) return raw;
  if (raw.startsWith('g:') && groups.some(g => g.id === raw.slice(2))) return raw;
  return SCOPE_ALL;
};

/**
 * Os ids das empresas escolhidas, ou null quando é "Todas" (sem limite). Num grupo, só contam
 * as empresas que a pessoa pode mesmo ver.
 */
export const scopeCompanyIds = (
  scope: string,
  companies: readonly ScopeCompany[],
  groups: readonly ScopeGroup[]
): Set<string> | null => {
  if (scope.startsWith('c:')) return new Set([scope.slice(2)]);
  if (scope.startsWith('g:')) {
    const group = groups.find(g => g.id === scope.slice(2));
    const visible = new Set(companies.map(c => c.id));
    return new Set((group?.companyIds ?? []).filter(id => visible.has(id)));
  }
  return null;
};

/** Esta empresa está dentro da escolha? (sem limite: sim; sem empresa: só sem limite) */
export const inScope = (ids: Set<string> | null, companyId: string | null | undefined): boolean =>
  ids === null || (!!companyId && ids.has(companyId));

/** Só os itens da escolha (devolve a mesma lista quando não há limite). */
export const filterByScope = <T>(
  items: readonly T[],
  ids: Set<string> | null,
  companyOf: (item: T) => string | null | undefined
): T[] => (ids === null ? [...items] : items.filter(item => inScope(ids, companyOf(item))));

/** O nome da escolha, para o botão do menu. */
export const scopeLabel = (
  scope: string,
  companies: readonly ScopeCompany[],
  groups: readonly ScopeGroup[]
): string => {
  if (scope.startsWith('c:')) {
    const company = companies.find(c => c.id === scope.slice(2));
    return company ? companyLabel(company.name) : 'Todas as empresas';
  }
  if (scope.startsWith('g:')) {
    const group = groups.find(g => g.id === scope.slice(2));
    return group ? group.name : 'Todas as empresas';
  }
  return 'Todas as empresas';
};

/** As linhas de rz_list_groups(), como grupos com os ids das empresas (por ordem de nome). */
export const scopeGroups = (
  rows: readonly { id: string; name: string; members: { companyId: string }[] }[]
): ScopeGroup[] =>
  sortCompanies(rows.map(row => ({ ...row, name: row.name }))).map(row => ({
    id: row.id,
    name: row.name,
    companyIds: row.members.map(m => m.companyId),
  }));

/** O ecrã só mostra o seletor quando há mais de uma empresa para escolher. */
export const hasScopeChoice = (companies: readonly ScopeCompany[]): boolean => companies.length > 1;
