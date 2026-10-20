import { describe, expect, it } from 'vitest';
import type { Credential, CredentialEmployee } from '../credentials';
import { buildEmailRows, countStates, filterEmailRows, withoutPersonalEmail } from '../emailRows';

const employee = (id: string, name: string, extra: Partial<CredentialEmployee> = {}) => ({
  id,
  name,
  company_id: 'c1',
  is_active: true,
  user_id: `u-${id}`,
  ...extra,
});

const credential = (
  id: string,
  username: string,
  category: string,
  employee_id: string | null = null
) =>
  ({
    id,
    title: username,
    username,
    password: 'x',
    url: null,
    notes: null,
    company_id: 'c1',
    category_id: category,
    employee_id,
    companies: { name: 'DASPRENT' },
    access_categories: { name: category, icon: null },
  }) as Credential;

const source = {
  employees: [
    employee('ana', 'Ana'),
    employee('rui', 'Rui'),
    employee('eva', 'Eva', { is_active: false }),
    employee('ze', 'Zé', { user_id: null }),
    employee('lia', 'Lia'),
  ],
  credentials: [
    credential('p1', 'ana@dasprent.pt', 'Email Pessoal', 'ana'),
    credential('p2', 'eva@dasprent.pt', 'Email Pessoal', 'eva'),
    credential('d1', 'geral@dasprent.pt', 'Email Departamental'),
    credential('s1', 'root@server.pt', 'Servidor', 'rui'),
  ],
  shares: new Map([['d1', ['rui', 'eva', 'ana']]]),
  mailboxes: new Map([
    [
      'd1',
      {
        access_id: 'd1',
        account_id: 'm1',
        status: 'active',
        last_error: null,
        provider: 'imap',
        members: ['Ana', 'Rui'],
      },
    ],
  ]),
};

describe('buildEmailRows', () => {
  const rows = buildEmailRows(source);
  const byId = Object.fromEntries(rows.map(r => [r.credential.id, r]));

  it('only lists email accesses, with who should get each mailbox', () => {
    expect(rows.map(r => r.credential.id)).toEqual(['p1', 'p2', 'd1']);
    expect(byId.p1).toMatchObject({ department: false, people: ['Ana'], state: 'pending' });
    // Inativos e quem não tem conta não contam.
    expect(byId.p2).toMatchObject({ people: [], state: 'nobody' });
    expect(byId.d1).toMatchObject({ department: true, people: ['Ana', 'Rui'], state: 'linked' });
  });

  it('filters by type and state and counts states', () => {
    const all = { search: '', companyId: 'all', type: 'all', state: 'all' } as const;
    expect(filterEmailRows(rows, { ...all, type: 'department' })).toHaveLength(1);
    expect(filterEmailRows(rows, { ...all, state: 'pending' }).map(r => r.credential.id)).toEqual([
      'p1',
    ]);
    expect(countStates(rows)).toEqual({ linked: 1, error: 0, pending: 1, nobody: 1 });
  });

  it('lists active employees with an account and no personal email', () => {
    expect(withoutPersonalEmail(source, 'all').map(e => e.id)).toEqual(['rui', 'lia']);
  });
});
