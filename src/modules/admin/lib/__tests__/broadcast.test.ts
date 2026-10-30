import { describe, expect, it } from 'vitest';
import {
  audienceLabel,
  departmentsOf,
  emptyAudience,
  recipientsOf,
  validateBroadcast,
  withoutEmail,
  type BroadcastEmployee,
} from '../broadcast';

const person = (id: string, overrides: Partial<BroadcastEmployee> = {}): BroadcastEmployee => ({
  id,
  name: id,
  email: `${id}@realize.pt`,
  company_id: 'c1',
  companyName: 'Realize',
  department: 'RH',
  is_active: true,
  user_id: null,
  ...overrides,
});

const team = [
  person('ana'),
  person('rui', { company_id: 'c2', department: 'Comercial' }),
  person('eva', { department: 'rh ' }),
  person('zé', { is_active: false }),
  person('sem', { email: '' }),
  person('dup', { email: 'ANA@realize.pt' }),
];

describe('broadcast audience', () => {
  it('sends to active people with a valid, unique email', () => {
    expect(recipientsOf(team, emptyAudience()).map(e => e.id)).toEqual(['ana', 'eva', 'rui']);
    expect(withoutEmail(team, emptyAudience())).toBe(1);
  });

  it('filters by company, department and chosen people', () => {
    expect(
      recipientsOf(team, { ...emptyAudience(), mode: 'company', companyIds: ['c2'] }).map(e => e.id)
    ).toEqual(['rui']);
    expect(
      recipientsOf(team, { ...emptyAudience(), mode: 'department', departments: ['RH'] }).map(
        e => e.id
      )
    ).toEqual(['ana', 'eva']);
    expect(
      recipientsOf(team, { ...emptyAudience(), mode: 'people', peopleIds: ['zé', 'rui'] }).map(
        e => e.id
      )
    ).toEqual(['rui']);
    expect(departmentsOf(team)).toEqual(['Comercial', 'RH']);
  });

  it('describes who it went to', () => {
    const companies = [
      { id: 'c1', name: 'Realize' },
      { id: 'c2', name: 'Dasprent' },
    ];
    expect(audienceLabel(emptyAudience(), companies)).toBe('Todos os colaboradores');
    expect(
      audienceLabel({ ...emptyAudience(), mode: 'company', companyIds: ['c2'] }, companies)
    ).toBe('Dasprent');
    expect(audienceLabel({ ...emptyAudience(), mode: 'people', peopleIds: ['a'] }, companies)).toBe(
      '1 pessoa'
    );
  });

  it('asks for subject, message, signature and someone to send to', () => {
    expect(validateBroadcast({ subject: '', message: ' ', senderName: '' }, 0)).toEqual({
      subject: 'Escreva o assunto.',
      message: 'Escreva a mensagem.',
      senderName: 'Indique o nome do remetente.',
      audience: 'Ninguém recebe com esta escolha.',
    });
    expect(validateBroadcast({ subject: 'Olá', message: 'Texto', senderName: 'RH' }, 3)).toEqual(
      {}
    );
  });
});
