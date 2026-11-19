import { describe, expect, it } from 'vitest';
import {
  SharingError,
  companiesWithoutGroup,
  companyAvailability,
  companyLabel,
  formatShareCode,
  groupOverview,
  groupDefaultsText,
  groupGrantable,
  groupableCapabilities,
  isSuperAdminAccount,
  normalizeShareCode,
  sharingErrorText,
  sortCompanies,
  sortRequests,
  toSharingError,
  type Capability,
  type GroupOverviewRow,
  type MyCompany,
  type ShareRequest,
} from '../sharing';

const cap = (over: Partial<Capability>): Capability => ({
  capability: 'tickets.read',
  module: 'tickets',
  kind: 'read',
  grantable: true,
  sensitive: false,
  min_role: 'colaborador',
  description: 'Ver tickets',
  ...over,
});

const request = (over: Partial<ShareRequest>): ShareRequest => ({
  request_id: 'r1',
  status: 'pedido',
  created_at: '2026-11-10T10:00:00Z',
  expires_at: '2026-11-24T10:00:00Z',
  other_company_id: null,
  other_company_name: null,
  ask: [],
  offer: [],
  decided_at: null,
  decision_note: null,
  ...over,
});

describe('toSharingError', () => {
  it('usa o message como código estável', () => {
    const error = toSharingError({
      message: 'already_pending',
      details: 'Já existe.',
      code: '55000',
    });
    expect(error.code).toBe('already_pending');
    expect(error.detail).toBe('Já existe.');
  });

  it('reconhece a reautenticação e o limite de tentativas pelo SQLSTATE', () => {
    expect(toSharingError({ message: 'x', code: 'RZ401' }).code).toBe('reauth_required');
    expect(toSharingError({ message: 'x', code: 'RZ429' }).code).toBe('rate_limited');
  });

  it('função inexistente quer dizer que a migração ainda não foi aplicada', () => {
    expect(toSharingError({ message: 'Could not find the function', code: 'PGRST202' }).code).toBe(
      'unavailable'
    );
  });

  it('mensagem que não é um código vira erro desconhecido', () => {
    expect(toSharingError({ message: 'Failed to fetch' }).code).toBe('unknown');
  });
});

describe('sharingErrorText', () => {
  it('nunca mostra o código em bruto', () => {
    expect(sharingErrorText(new SharingError('already_pending'))).not.toMatch(/already_pending/);
    expect(sharingErrorText(new Error('boom'))).toBe('Não foi possível concluir. Tente outra vez.');
  });

  it('um código novo do servidor usa a frase do servidor', () => {
    expect(sharingErrorText(new SharingError('novo_codigo', 'Frase do servidor.'))).toBe(
      'Frase do servidor.'
    );
  });
});

describe('códigos da empresa', () => {
  it('normaliza espaços, hífenes e minúsculas', () => {
    expect(normalizeShareCode(' abcde-fghjk ')).toEqual({ code: 'ABCDEFGHJK', valid: true });
  });

  it('recusa letras e números que o alfabeto não tem (I, O, 0, 1) e tamanhos errados', () => {
    expect(normalizeShareCode('ABCDEFGHJ0').valid).toBe(false);
    expect(normalizeShareCode('ABCDEFGHIK').valid).toBe(false);
    expect(normalizeShareCode('ABC').valid).toBe(false);
  });

  it('mostra o código em dois blocos de cinco', () => {
    expect(formatShareCode('ABCDEFGHJK')).toBe('ABCDE FGHJK');
  });
});

describe('groupGrantable', () => {
  it('deixa de fora o que não se pode partilhar e agrupa por módulo', () => {
    const groups = groupGrantable([
      cap({}),
      cap({ capability: 'tickets.write' }),
      cap({ capability: 'hr.read', module: 'hr', grantable: false }),
      cap({ capability: 'mail.use', module: 'mail' }),
    ]);
    expect(groups.map(g => g.module)).toEqual(['tickets', 'mail']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].label).toBe('Tickets');
  });
});

describe('sortRequests', () => {
  it('põe os pedidos por responder primeiro e depois os mais recentes', () => {
    const sorted = sortRequests([
      request({ request_id: 'velho', status: 'recusado', created_at: '2026-11-01T00:00:00Z' }),
      request({ request_id: 'aberto', created_at: '2026-11-05T00:00:00Z' }),
      request({ request_id: 'recente', status: 'aprovado', created_at: '2026-11-09T00:00:00Z' }),
    ]);
    expect(sorted.map(r => r.request_id)).toEqual(['aberto', 'recente', 'velho']);
  });
});

describe('vista de todos os grupos', () => {
  const row = (
    group: string,
    name: string,
    company: string,
    companyName: string
  ): GroupOverviewRow => ({
    group_id: group,
    group_name: name,
    group_created_at: '2026-11-17T10:00:00Z',
    company_id: company,
    company_name: companyName,
    joined_at: '2026-11-17T10:00:00Z',
    origin: 'migracao',
  });
  const company = (id: string, name: string, role = 'super_admin'): MyCompany => ({
    company_id: id,
    name,
    role,
    status: 'ativo',
    origin: 'super_admin',
    is_group_member: false,
  });

  it('agrupa as linhas por grupo, com grupos e empresas por ordem de nome', () => {
    const groups = groupOverview([
      row('g2', 'Urbango', 'c3', 'Pro Peças'),
      row('g1', 'Realize', 'c2', 'UseAuto'),
      row('g1', 'Realize', 'c1', 'DASP AUTO REPAIR'),
      row('g2', 'Urbango', 'c4', 'Abreu e Pereira'),
    ]);
    expect(groups.map(g => g.name)).toEqual(['Realize', 'Urbango']);
    expect(groups[0].members.map(m => m.name)).toEqual(['DASP AUTO REPAIR', 'UseAuto']);
    expect(groups[1].members.map(m => m.name)).toEqual(['Abreu e Pereira', 'Pro Peças']);
  });

  it('sem linhas, não há grupos', () => {
    expect(groupOverview([])).toEqual([]);
  });

  it('as empresas sem grupo são as que nenhuma linha refere', () => {
    const all = [company('c1', 'Zeta'), company('c2', 'Alfa'), company('c3', 'Meta')];
    const alone = companiesWithoutGroup(all, [row('g1', 'Realize', 'c3', 'Meta')]);
    expect(alone.map(c => c.name)).toEqual(['Alfa', 'Zeta']);
    expect(companiesWithoutGroup(all, [])).toHaveLength(3);
  });

  it('só uma conta com empresas como Super Admin tem a vista', () => {
    expect(isSuperAdminAccount([company('c1', 'A')])).toBe(true);
    expect(isSuperAdminAccount([company('c1', 'A', 'admin'), company('c2', 'B', 'gestor')])).toBe(
      false
    );
    expect(isSuperAdminAccount([])).toBe(false);
  });
});

describe('nomes e ordem das empresas', () => {
  const named = (name: string) => ({ name });

  it('o nome para mostrar não leva espaços a mais (a Razão Dinâmica tem um no início)', () => {
    expect(companyLabel(' Razão Dinâmica, Lda')).toBe('Razão Dinâmica, Lda');
    expect(companyLabel('DASP   AUTO  REPAIR ')).toBe('DASP AUTO REPAIR');
  });

  it('ordena por nome, ignorando o espaço no início, os acentos e as maiúsculas', () => {
    const sorted = sortCompanies([
      named('Premium Ride'),
      named(' Razão Dinâmica, Lda'),
      named('abreu e Pereira'),
      named('Década Ousada'),
      named('BVSeguros'),
    ]).map(c => companyLabel(c.name));
    expect(sorted).toEqual([
      'abreu e Pereira',
      'BVSeguros',
      'Década Ousada',
      'Premium Ride',
      'Razão Dinâmica, Lda',
    ]);
  });

  it('não altera a lista original', () => {
    const original = [named('B'), named('A')];
    sortCompanies(original);
    expect(original.map(c => c.name)).toEqual(['B', 'A']);
  });
});

describe('módulos por defeito de um grupo', () => {
  const catalog: Capability[] = [
    cap({ capability: 'directory.read', module: 'directory', description: 'Ver colaboradores' }),
    cap({ capability: 'feed.read', module: 'feed', description: 'Ver comunicados' }),
    cap({ capability: 'tickets.write', module: 'tickets', kind: 'write' }),
    cap({ capability: 'access.reveal', module: 'access', kind: 'read', sensitive: true }),
    cap({ capability: 'hr.read', module: 'hr', kind: 'read', grantable: false }),
  ];

  it('só entram permissões de leitura, partilháveis e não sensíveis', () => {
    expect(groupableCapabilities(catalog).map(item => item.capability)).toEqual([
      'directory.read',
      'feed.read',
    ]);
  });

  it('o texto lista os módulos sem repetir, ou diz que não há nada por defeito', () => {
    expect(groupDefaultsText(['directory.read', 'feed.read', 'directory.write'])).toBe(
      'Colaboradores, Comunicados de grupo'
    );
    expect(groupDefaultsText([])).toBe('Nada por defeito');
    expect(groupDefaultsText(undefined)).toBe('Nada por defeito');
  });

  it('a vista de todos os grupos traz os módulos (vazio se a base ainda não os devolve)', () => {
    const base = {
      group_name: 'G',
      group_created_at: '2026-11-17T10:00:00Z',
      joined_at: '2026-11-17T10:00:00Z',
      origin: 'manual' as const,
    };
    const [withCaps, without] = groupOverview([
      {
        ...base,
        group_id: 'g1',
        company_id: 'a',
        company_name: 'A',
        default_capabilities: ['feed.read'],
      },
      { ...base, group_id: 'g2', group_name: 'H', company_id: 'b', company_name: 'B' },
    ]);
    expect(withCaps.defaultCapabilities).toEqual(['feed.read']);
    expect(without.defaultCapabilities).toEqual([]);
  });
});

describe('companyAvailability', () => {
  const mine = (id: string, name: string): MyCompany => ({
    company_id: id,
    name,
    role: 'super_admin',
    status: 'ativo',
    origin: 'x',
    is_group_member: false,
  });
  const row = (group: string, company: string): GroupOverviewRow => ({
    group_id: group,
    group_name: `Grupo ${group}`,
    group_created_at: '2026-11-17T10:00:00Z',
    company_id: company,
    company_name: company,
    joined_at: '2026-11-17T10:00:00Z',
    origin: 'manual',
  });
  const all = [mine('a', 'Alfa'), mine('b', 'Beta'), mine('c', 'Gama')];

  it('empresas sem grupo ficam livres; as de outro grupo ficam recusadas com o nome do grupo', () => {
    const result = companyAvailability(all, [row('g1', 'a')], null);
    expect(result.find(item => item.id === 'b')?.reason).toBeUndefined();
    expect(result.find(item => item.id === 'a')?.reason).toBe('Já pertence ao grupo Grupo g1');
  });

  it('as empresas do próprio grupo que se está a gerir não ficam recusadas', () => {
    const result = companyAvailability(all, [row('g1', 'a'), row('g2', 'c')], 'g1');
    expect(result.find(item => item.id === 'a')?.reason).toBeUndefined();
    expect(result.find(item => item.id === 'c')?.reason).toBe('Já pertence ao grupo Grupo g2');
  });

  it('vem por ordem de nome', () => {
    expect(companyAvailability(all, [], null).map(item => item.name)).toEqual([
      'Alfa',
      'Beta',
      'Gama',
    ]);
  });
});
