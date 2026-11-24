import { describe, expect, it } from 'vitest';
import { adminCountOf, adminCountsByCompany, groupNameOf } from '../companySummary';

describe('adminCountsByCompany: nº de administradores por empresa', () => {
  it('conta pessoas distintas por empresa', () => {
    const counts = adminCountsByCompany([
      { company_id: 'c1', user_id: 'u1' },
      { company_id: 'c1', user_id: 'u2' },
      { company_id: 'c1', user_id: 'u2' },
      { company_id: 'c2', user_id: 'u3' },
    ]);
    expect(counts.get('c1')).toBe(2);
    expect(counts.get('c2')).toBe(1);
  });
});

describe('adminCountOf: "0" e "não sei" não são a mesma coisa', () => {
  const counts = new Map([['c1', 2]]);

  it('super admin: empresa sem linhas tem mesmo 0 administradores', () => {
    expect(adminCountOf('c9', counts, true, new Set())).toBe(0);
    expect(adminCountOf('c1', counts, true, new Set())).toBe(2);
  });

  it('admin de empresa: só sabe das empresas que administra', () => {
    expect(adminCountOf('c1', counts, false, new Set(['c1']))).toBe(2);
    expect(adminCountOf('c2', counts, false, new Set(['c1', 'c2']))).toBe(0);
    expect(adminCountOf('c3', counts, false, new Set(['c1']))).toBeNull();
  });

  it('enquanto as contagens carregam não há número', () => {
    expect(adminCountOf('c1', null, true, new Set())).toBeNull();
  });
});

describe('groupNameOf: grupo de cada empresa', () => {
  it('super admin vê o nome do grupo', () => {
    const groups = new Map([['c1', 'Grupo Realize']]);
    expect(groupNameOf('c1', groups, true, new Set())).toBe('Grupo Realize');
    expect(groupNameOf('c2', groups, true, new Set())).toBeNull();
  });

  it('os outros só sabem se a empresa está em grupo', () => {
    expect(groupNameOf('c1', new Map(), false, new Set(['c1']))).toBe('Em grupo');
    expect(groupNameOf('c2', new Map(), false, new Set(['c1']))).toBeNull();
  });
});
