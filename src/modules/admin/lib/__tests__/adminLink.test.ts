import { describe, expect, it } from 'vitest';
import { isSamePerson, linkableAccounts, suggestedAccount, type AdminAccount } from '../adminLink';

const account = (name: string, overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  userId: name,
  name,
  email: `${name}@x.pt`,
  linkedEmployeeId: null,
  linkedEmployeeName: null,
  isEmployeeAccount: false,
  ...overrides,
});

describe('adminLink', () => {
  it('matches the admin name inside the full employee name', () => {
    expect(isSamePerson('Dinis Silva', 'Dinis da Silva Assunção')).toBe(true);
    expect(isSamePerson('João Bahia', 'João Victor Da Silva Bahia ')).toBe(true);
    expect(isSamePerson('Vania Sousa', 'Vânia Alexandra da Silva Sousa')).toBe(true);
    expect(isSamePerson('Thiago Galdino de Sousa', 'Thiago De Souza Quesada Fernandes')).toBe(
      false
    );
    expect(isSamePerson('Silva', 'Dinis da Silva')).toBe(false);
  });

  it('only offers accounts not linked yet and not used by a collaborator', () => {
    const accounts = [
      account('Dinis Silva'),
      account('Beatriz Veloso', { linkedEmployeeId: 'e1', linkedEmployeeName: 'Beatriz Veloso' }),
      account('Paulo Simão', { isEmployeeAccount: true }),
    ];
    expect(linkableAccounts(accounts).map(a => a.name)).toEqual(['Dinis Silva']);
    expect(suggestedAccount(accounts, 'Dinis da Silva Assunção')?.name).toBe('Dinis Silva');
    expect(suggestedAccount(accounts, 'Beatriz Veloso')).toBeNull();
  });
});
