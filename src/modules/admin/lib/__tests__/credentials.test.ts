import { describe, expect, it } from 'vitest';
import {
  categoryForKind,
  emailDomainFor,
  fullAddress,
  generatePassword,
  kindOfCategory,
  localPart,
  mailboxState,
  matchesCredential,
  type Credential,
} from '../credentials';

const categories = [
  { id: 'c1', name: 'Email Pessoal', icon: 'mail' },
  { id: 'c2', name: 'Email Departamental', icon: 'mail' },
  { id: 'c3', name: 'Sistema/Aplicação', icon: 'monitor' },
  { id: 'c4', name: 'Servidor', icon: 'server' },
];

describe('tipos de acesso', () => {
  it('reads the kind from the category name', () => {
    expect(kindOfCategory('Email Pessoal')).toBe('email_personal');
    expect(kindOfCategory('Email Departamental')).toBe('email_department');
    expect(kindOfCategory('Sistema/Aplicação')).toBe('site');
    expect(kindOfCategory('Servidor')).toBe('other');
    expect(kindOfCategory(null)).toBe('other');
  });

  it('finds the category of each email kind', () => {
    expect(categoryForKind('email_personal', categories)?.id).toBe('c1');
    expect(categoryForKind('email_department', categories)?.id).toBe('c2');
    expect(categoryForKind('site', categories)?.id).toBe('c3');
    expect(categoryForKind('other', categories)).toBeNull();
  });
});

describe('endereços', () => {
  it('adds the company domain unless a full address was typed', () => {
    expect(fullAddress(' Ana.Silva ', 'dasprent.pt')).toBe('ana.silva@dasprent.pt');
    expect(fullAddress('geral@outro.pt', 'dasprent.pt')).toBe('geral@outro.pt');
    expect(fullAddress('geral', null)).toBe('geral');
    expect(localPart('ana@dasprent.pt', 'dasprent.pt')).toBe('ana');
    expect(localPart('ana@gmail.com', 'dasprent.pt')).toBe('ana@gmail.com');
  });

  it('generates passwords without look-alike characters', () => {
    const password = generatePassword(40);
    expect(password).toHaveLength(40);
    expect(password).not.toMatch(/[0O1lI]/);
  });
});

describe('estado da caixa', () => {
  const linked = {
    access_id: 'a',
    account_id: 'm',
    status: 'active',
    last_error: null,
    provider: 'imap',
    members: ['Ana'],
  };
  it('tells linked, broken, pending and unassigned apart', () => {
    expect(mailboxState(linked, 1)).toBe('linked');
    expect(mailboxState({ ...linked, last_error: 'login falhou' }, 1)).toBe('error');
    expect(mailboxState(undefined, 2)).toBe('pending');
    expect(mailboxState(undefined, 0)).toBe('nobody');
  });
});

describe('pesquisa', () => {
  const credential = {
    id: '1',
    title: 'Email Ana',
    username: 'ana@dasprent.pt',
    company_id: 'x',
    companies: { name: 'DASPRENT' },
    employees: { name: 'Ana Sousa' },
  } as Credential;
  it('searches title, address, company and person', () => {
    expect(matchesCredential(credential, { search: 'sousa', companyId: 'all' })).toBe(true);
    expect(matchesCredential(credential, { search: 'dasprent', companyId: 'x' })).toBe(true);
    expect(matchesCredential(credential, { search: '', companyId: 'y' })).toBe(false);
  });
});

describe('emailDomainFor', () => {
  const email = (company_id: string, username: string) =>
    ({
      company_id,
      username,
      access_categories: { name: 'Email Pessoal', icon: null },
    }) as Credential;
  it('uses the company domain (without @) or the most used one', () => {
    const companies = [
      { id: 'a', name: 'A', domain: '@dasprentsul.pt' },
      { id: 'b', name: 'B', domain: null },
    ];
    const credentials = [
      email('b', 'x@dasprent.pt'),
      email('b', 'y@dasprent.pt'),
      email('b', 'z@gmail.com'),
    ];
    expect(emailDomainFor('a', companies, credentials)).toBe('dasprentsul.pt');
    expect(emailDomainFor('b', companies, credentials)).toBe('dasprent.pt');
    expect(emailDomainFor('c', companies, credentials)).toBeNull();
  });
});
