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
