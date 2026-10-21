// Acessos → Emails: uma linha por caixa (acesso de email), com quem a tem e o estado no Webmail.
import {
  isDepartmentCategory,
  isEmailCategory,
  mailboxState,
  matchesCredential,
  type Credential,
  type CredentialEmployee,
  type MailboxState,
  type MailboxStatus,
} from './credentials';

export interface EmailRowData {
  credential: Credential;
  department: boolean;
  /** Nomes de quem deve ter a caixa (o dono, ou as pessoas do departamental). */
  people: string[];
  mailbox: MailboxStatus | undefined;
  state: MailboxState;
}

export interface EmailFilters {
  search: string;
  companyId: string;
  type: 'all' | 'personal' | 'department';
  state: 'all' | MailboxState;
}

interface Source {
  credentials: Credential[];
  employees: CredentialEmployee[];
  shares: Map<string, string[]>;
  mailboxes: Map<string, MailboxStatus>;
}

export const buildEmailRows = (source: Source): EmailRowData[] => {
  const byId = new Map(source.employees.map(e => [e.id, e]));
  // Só conta quem pode receber a caixa: ativo e com conta na app.
  const canReceive = (id: string | null) => {
    const employee = id ? byId.get(id) : undefined;
    return employee && employee.is_active && employee.user_id ? employee : null;
  };
  return source.credentials
    .filter(c => isEmailCategory(c.access_categories?.name))
    .map(credential => {
      const department = isDepartmentCategory(credential.access_categories?.name);
      // Departamental: as pessoas da partilha; pessoal: o dono e quem mais tem acesso.
      const ids = new Set([
        ...(department ? [] : [credential.employee_id]),
        ...(source.shares.get(credential.id) ?? []),
      ]);
      const people = [...ids]
        .map(canReceive)
        .filter((e): e is CredentialEmployee => !!e)
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      const mailbox = source.mailboxes.get(credential.id);
      return {
        credential,
        department,
        people,
        mailbox,
        state: mailboxState(mailbox, people.length),
      };
    })
    .sort((a, b) => a.credential.username.localeCompare(b.credential.username));
};

export const filterEmailRows = (rows: EmailRowData[], filters: EmailFilters) =>
  rows.filter(
    row =>
      (filters.type === 'all' || (filters.type === 'department') === row.department) &&
      (filters.state === 'all' || row.state === filters.state) &&
      matchesCredential(row.credential, filters)
  );

export const countStates = (rows: EmailRowData[]): Record<MailboxState, number> => {
  const counts = { linked: 0, error: 0, pending: 0, nobody: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
};

/** Colaboradores ativos, com conta na app, que ainda não têm email pessoal nos Acessos. */
export const withoutPersonalEmail = (source: Source, companyId: string): CredentialEmployee[] => {
  const owners = new Set(
    source.credentials
      .filter(
        c =>
          isEmailCategory(c.access_categories?.name) &&
          !isDepartmentCategory(c.access_categories?.name)
      )
      .map(c => c.employee_id)
  );
  return source.employees.filter(
    e =>
      e.is_active &&
      e.user_id &&
      !owners.has(e.id) &&
      (companyId === 'all' || e.company_id === companyId)
  );
};

const searchable = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const NAME_STOP = new Set(['da', 'de', 'do', 'dos', 'das', 'e', 'junior']);

/**
 * Emails pessoais sem dono que parecem ser deste colaborador: a parte antes do @ tem pelo
 * menos dois dos nomes dele (ex.: Carlos Filipe Matos Soares → filipe.soares@…).
 */
export const suggestedEmails = (
  employee: Pick<CredentialEmployee, 'name'>,
  credentials: Credential[]
): Credential[] => {
  const names = searchable(employee.name)
    .split(/\s+/)
    .filter(token => token.length > 2 && !NAME_STOP.has(token));
  return credentials.filter(credential => {
    const category = credential.access_categories?.name;
    if (credential.employee_id || !isEmailCategory(category) || isDepartmentCategory(category))
      return false;
    const parts = searchable(credential.username.split('@')[0])
      .split(/[._\-0-9]+/)
      .filter(Boolean);
    return names.filter(name => parts.includes(name)).length >= 2;
  });
};

export interface EmployeeEmail {
  credential: Credential;
  /** Dono (email pessoal dele) ou partilhado (departamental, ou pessoal de outra pessoa). */
  role: 'owner' | 'shared';
  department: boolean;
  mailbox: MailboxStatus | undefined;
}

/** As caixas de email de um colaborador: as dele e as que partilha. */
export const emailsOfEmployee = (employeeId: string, source: Source): EmployeeEmail[] =>
  source.credentials
    .filter(c => isEmailCategory(c.access_categories?.name))
    .flatMap(credential => {
      const department = isDepartmentCategory(credential.access_categories?.name);
      const owner = !department && credential.employee_id === employeeId;
      const shared = (source.shares.get(credential.id) ?? []).includes(employeeId);
      if (!owner && !shared) return [];
      return [
        {
          credential,
          role: owner ? ('owner' as const) : ('shared' as const),
          department,
          mailbox: source.mailboxes.get(credential.id),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.role === 'owner') - Number(a.role === 'owner') ||
        a.credential.username.localeCompare(b.credential.username)
    );

/**
 * Emails que se podem ligar a este colaborador: os sugeridos pelo nome primeiro; com
 * pesquisa, qualquer email (endereço ou nome) que ainda não seja dele.
 */
export const emailCandidates = (
  employee: Pick<CredentialEmployee, 'id' | 'name'>,
  source: Source,
  search: string
): Credential[] => {
  const mine = new Set(emailsOfEmployee(employee.id, source).map(e => e.credential.id));
  const suggested = suggestedEmails(employee, source.credentials).filter(c => !mine.has(c.id));
  if (!search.trim()) return suggested;
  const found = source.credentials.filter(
    c =>
      isEmailCategory(c.access_categories?.name) &&
      !mine.has(c.id) &&
      matchesCredential(c, { search, companyId: 'all' })
  );
  return [
    ...suggested.filter(c => found.includes(c)),
    ...found.filter(c => !suggested.includes(c)),
  ].slice(0, 20);
};
