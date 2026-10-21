// Ficha do colaborador → Conta de administrador: que conta de admin é da mesma pessoa.
import { normalizeForSearch } from '@/lib/utils';

export interface AdminAccount {
  userId: string;
  name: string;
  email: string;
  linkedEmployeeId: string | null;
  linkedEmployeeName: string | null;
  /** A conta de admin é também a conta de um colaborador (um só login). */
  isEmployeeAccount: boolean;
}

const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

const nameTokens = (name: string): string[] =>
  normalizeForSearch(name)
    .split(/\s+/)
    .filter(token => token && !PARTICLES.has(token));

/**
 * O nome do admin cabe no do colaborador: mesmo primeiro nome e todos os outros presentes
 * ("Dinis Silva" ↔ "Dinis da Silva Assunção").
 */
export const isSamePerson = (adminName: string, employeeName: string): boolean => {
  const admin = nameTokens(adminName);
  const employee = nameTokens(employeeName);
  if (admin.length < 2 || admin[0] !== employee[0]) return false;
  return admin.every(token => employee.includes(token));
};

/** Contas que se podem ligar a esta ficha: sem ficha ligada e que não são de um colaborador. */
export const linkableAccounts = (accounts: AdminAccount[]): AdminAccount[] =>
  accounts.filter(account => !account.linkedEmployeeId && !account.isEmployeeAccount);

/** A conta de admin que parece ser desta pessoa (só se houver uma). */
export const suggestedAccount = (
  accounts: AdminAccount[],
  employeeName: string
): AdminAccount | null => {
  const matches = linkableAccounts(accounts).filter(account =>
    isSamePerson(account.name, employeeName)
  );
  return matches.length === 1 ? matches[0] : null;
};
