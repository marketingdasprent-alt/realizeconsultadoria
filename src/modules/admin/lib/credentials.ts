// Acessos (credenciais): tipos e regras partilhadas pelas abas Emails e Acessos e pelo painel
// de novo acesso. O tipo de um acesso vem da categoria (o admin antigo usa as mesmas).
import { matchesSearch } from '@/lib/utils';

export interface Credential {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string | null;
  notes: string | null;
  company_id: string;
  category_id: string | null;
  employee_id: string | null;
  companies?: { name: string } | null;
  access_categories?: { name: string; icon: string | null } | null;
  employees?: { name: string } | null;
}

export interface CredentialCategory {
  id: string;
  name: string;
  icon: string | null;
}

export interface CredentialCompany {
  id: string;
  name: string;
  domain: string | null;
}

export interface CredentialEmployee {
  id: string;
  name: string;
  company_id: string;
  is_active: boolean;
  user_id: string | null;
}

/** Estado da caixa de um acesso no Webmail (mail_access_status). */
export interface MailboxStatus {
  access_id: string;
  account_id: string;
  status: string;
  last_error: string | null;
  provider: string | null;
  members: string[];
}

export type AccessKind = 'email_personal' | 'email_department' | 'site' | 'other';

const lower = (value: string | null | undefined) => (value ?? '').toLowerCase();

export const isEmailCategory = (name: string | null | undefined) => lower(name).includes('email');
export const isDepartmentCategory = (name: string | null | undefined) =>
  lower(name).includes('departamental');
export const isMainAccessCategory = (name: string | null | undefined) =>
  lower(name).includes('principal');

/** Tipo do acesso para o painel (Email pessoal / departamental / Site ou sistema / Outro). */
export const kindOfCategory = (name: string | null | undefined): AccessKind => {
  if (isEmailCategory(name))
    return isDepartmentCategory(name) ? 'email_department' : 'email_personal';
  const value = lower(name);
  if (value.includes('sistema') || value.includes('aplica') || value.includes('site'))
    return 'site';
  return 'other';
};

/** Categoria a usar para um tipo de email (a primeira cujo nome bate). */
export const categoryForKind = (
  kind: AccessKind,
  categories: CredentialCategory[]
): CredentialCategory | null => {
  if (kind === 'email_department')
    return categories.find(c => isEmailCategory(c.name) && isDepartmentCategory(c.name)) ?? null;
  if (kind === 'email_personal')
    return categories.find(c => isEmailCategory(c.name) && !isDepartmentCategory(c.name)) ?? null;
  if (kind === 'site') return categories.find(c => kindOfCategory(c.name) === 'site') ?? null;
  return categories.find(c => lower(c.name) === 'outro') ?? null;
};

export const isEmailCredential = (credential: Credential) =>
  isEmailCategory(credential.access_categories?.name);

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Endereço completo: a parte antes do @ mais o domínio da empresa (se não vier já). */
export const fullAddress = (local: string, domain: string | null): string => {
  const value = local.trim().toLowerCase();
  if (!domain || value.includes('@')) return value;
  return `${value}@${domain.toLowerCase()}`;
};

/** A parte antes do @ quando o endereço é do domínio da empresa (para editar). */
export const localPart = (address: string, domain: string | null): string =>
  domain && address.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
    ? address.slice(0, -(domain.length + 1))
    : address;

/** Palavra-passe forte e fácil de ditar (sem 0/O, 1/l/I). */
export const generatePassword = (length = 16): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
};

export type MailboxState = 'linked' | 'error' | 'pending' | 'nobody';

/** Estado da caixa no Webmail: ligada, com erro, por ligar (há a quem dar) ou sem pessoas. */
export const mailboxState = (status: MailboxStatus | undefined, people: number): MailboxState => {
  if (status) return status.status === 'active' && !status.last_error ? 'linked' : 'error';
  return people > 0 ? 'pending' : 'nobody';
};

export interface CredentialFilters {
  search: string;
  companyId: string;
}

export const matchesCredential = (credential: Credential, filters: CredentialFilters) =>
  (filters.companyId === 'all' || credential.company_id === filters.companyId) &&
  matchesSearch(
    [credential.title, credential.username, credential.companies?.name, credential.employees?.name]
      .filter(Boolean)
      .join(' '),
    filters.search
  );

/** "@dasprentsul.pt " → "dasprentsul.pt" (o campo da empresa às vezes vem com o @). */
const cleanDomain = (domain: string | null | undefined) =>
  domain ? domain.trim().replace(/^@+/, '').toLowerCase() || null : null;

/**
 * Domínio dos emails de uma empresa: o configurado na empresa ou, sem ele, o mais usado
 * nos emails que a empresa já tem nos Acessos.
 */
export const emailDomainFor = (
  companyId: string,
  companies: CredentialCompany[],
  credentials: Credential[]
): string | null => {
  const configured = cleanDomain(companies.find(c => c.id === companyId)?.domain);
  if (configured) return configured;
  const counts = new Map<string, number>();
  for (const credential of credentials) {
    if (credential.company_id !== companyId || !isEmailCredential(credential)) continue;
    const domain = credential.username.split('@')[1]?.trim().toLowerCase();
    if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};
