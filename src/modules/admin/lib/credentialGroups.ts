// Acessos → Acessos: as credenciais que não são email, agrupadas por categoria.
import {
  isEmailCategory,
  isMainAccessCategory,
  matchesCredential,
  type Credential,
  type CredentialCategory,
  type CredentialEmployee,
  type CredentialFilters,
} from './credentials';

export interface CredentialGroup {
  key: string;
  name: string;
  credentials: Credential[];
}

const NO_CATEGORY = 'Sem categoria';

export const groupCredentials = (
  credentials: Credential[],
  filters: CredentialFilters & { categoryId: string }
): CredentialGroup[] => {
  const groups = new Map<string, CredentialGroup>();
  for (const credential of credentials) {
    if (isEmailCategory(credential.access_categories?.name)) continue;
    if (filters.categoryId !== 'all' && credential.category_id !== filters.categoryId) continue;
    if (!matchesCredential(credential, filters)) continue;
    const key = credential.category_id ?? 'none';
    const group = groups.get(key) ?? {
      key,
      name: credential.access_categories?.name ?? NO_CATEGORY,
      credentials: [],
    };
    group.credentials.push(credential);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(group => ({
      ...group,
      credentials: group.credentials.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) =>
      a.name === NO_CATEGORY ? 1 : b.name === NO_CATEGORY ? -1 : a.name.localeCompare(b.name)
    );
};

/** Colaboradores ativos sem "Acesso Principal" (quando essa categoria existe). */
export const withoutMainAccess = (
  credentials: Credential[],
  categories: CredentialCategory[],
  employees: CredentialEmployee[],
  companyId: string
): { category: CredentialCategory | null; people: CredentialEmployee[] } => {
  const category = categories.find(c => isMainAccessCategory(c.name)) ?? null;
  if (!category) return { category, people: [] };
  const owners = new Set(
    credentials.filter(c => c.category_id === category.id).map(c => c.employee_id)
  );
  // Sem nenhum acesso principal ligado a colaboradores, a categoria não é usada assim.
  owners.delete(null);
  if (owners.size === 0) return { category, people: [] };
  return {
    category,
    people: employees.filter(
      e => e.is_active && !owners.has(e.id) && (companyId === 'all' || e.company_id === companyId)
    ),
  };
};
