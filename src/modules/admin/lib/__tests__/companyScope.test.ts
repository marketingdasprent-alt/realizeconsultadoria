import { describe, expect, it } from 'vitest';
import {
  filterByScope,
  groupScope,
  companyScope,
  inScope,
  scopeCompanyIds,
  scopeLabel,
  validScope,
} from '../companyScope';

const companies = [
  { id: 'c1', name: ' Razão Dinâmica, Lda' },
  { id: 'c2', name: 'Abreu e Pereira' },
  { id: 'c3', name: 'Realize' },
];
const groups = [{ id: 'g1', name: 'Grupo Urbango', companyIds: ['c1', 'c2', 'c9'] }];

describe('validScope', () => {
  it('aceita "all", uma empresa e um grupo que existem', () => {
    expect(validScope('all', companies, groups)).toBe('all');
    expect(validScope(companyScope('c2'), companies, groups)).toBe('c:c2');
    expect(validScope(groupScope('g1'), companies, groups)).toBe('g:g1');
  });
  it('volta a "all" se a empresa ou o grupo já não existem, ou o texto é estranho', () => {
    expect(validScope('c:zzz', companies, groups)).toBe('all');
    expect(validScope('g:zzz', companies, groups)).toBe('all');
    expect(validScope('lixo', companies, groups)).toBe('all');
    expect(validScope(null, companies, groups)).toBe('all');
  });
});

describe('scopeCompanyIds', () => {
  it('"all" não limita', () => expect(scopeCompanyIds('all', companies, groups)).toBeNull());
  it('uma empresa limita a ela', () =>
    expect([...(scopeCompanyIds('c:c3', companies, groups) ?? [])]).toEqual(['c3']));
  it('um grupo conta só as empresas que a pessoa vê', () =>
    expect([...(scopeCompanyIds('g:g1', companies, groups) ?? [])].sort()).toEqual(['c1', 'c2']));
});

describe('filterByScope e inScope', () => {
  const people = [
    { id: 1, company: 'c1' },
    { id: 2, company: 'c3' },
    { id: 3, company: null },
  ];
  it('sem limite devolve tudo, incluindo quem não tem empresa', () =>
    expect(filterByScope(people, null, p => p.company)).toHaveLength(3));
  it('com limite deixa só a empresa escolhida e tira quem não tem empresa', () => {
    const ids = new Set(['c1']);
    expect(filterByScope(people, ids, p => p.company).map(p => p.id)).toEqual([1]);
    expect(inScope(ids, null)).toBe(false);
  });
});

describe('scopeLabel', () => {
  it('mostra o nome da empresa sem espaços a mais, ou o do grupo', () => {
    expect(scopeLabel('c:c1', companies, groups)).toBe('Razão Dinâmica, Lda');
    expect(scopeLabel('g:g1', companies, groups)).toBe('Grupo Urbango');
    expect(scopeLabel('all', companies, groups)).toBe('Todas as empresas');
  });
});
