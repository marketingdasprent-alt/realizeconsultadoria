// O que a lista de Empresas mostra por empresa além dos dados: o grupo e o nº de administradores.

interface AdminMembershipRow {
  company_id: string;
  user_id: string;
}

/** Pessoas distintas com pertença de administrador ativa, por empresa. */
export const adminCountsByCompany = (rows: readonly AdminMembershipRow[]): Map<string, number> => {
  const people = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = people.get(row.company_id) ?? new Set<string>();
    set.add(row.user_id);
    people.set(row.company_id, set);
  }
  return new Map([...people].map(([company, set]) => [company, set.size]));
};

/**
 * Administradores de uma empresa. O super admin lê todas as pertenças, por isso "sem linhas" é 0.
 * Um admin de empresa só lê as das empresas que administra: nas outras não sabe (null, não 0).
 */
export const adminCountOf = (
  companyId: string,
  counts: ReadonlyMap<string, number> | null,
  isSuperAdmin: boolean,
  administered: ReadonlySet<string>
): number | null => {
  if (!counts) return null;
  if (!isSuperAdmin && !administered.has(companyId)) return null;
  return counts.get(companyId) ?? 0;
};

/** O super admin vê o nome do grupo; os outros só sabem se a empresa está num grupo. */
export const groupNameOf = (
  companyId: string,
  groupByCompany: ReadonlyMap<string, string>,
  isSuperAdmin: boolean,
  inGroup: ReadonlySet<string>
): string | null =>
  isSuperAdmin
    ? (groupByCompany.get(companyId) ?? null)
    : inGroup.has(companyId)
      ? 'Em grupo'
      : null;
