import { describe, expect, it } from 'vitest';
import {
  adminCandidates,
  adminCount,
  bulkItemError,
  bulkSummaryText,
  canManageCompany,
  canOfferMove,
  canRemoveViewer,
  commonOrigin,
  describePendingEffects,
  filterByName,
  isLastAdmin,
  manageableCompanies,
  membershipErrorText,
  parseBulkResult,
  parseTransferResult,
  splitMovable,
  sumPendingEffects,
  transferTargets,
  type MovableEmployee,
  type PendingEffects,
} from '../companyMembership';
import { SharingError, type CompanyViewer, type MyCompany } from '../sharing';

const company = (id: string, name: string, role = 'admin'): MyCompany => ({
  company_id: id,
  name,
  role,
  status: 'ativo',
  origin: 'migracao',
  is_group_member: false,
});

const MINE = [
  company('b', 'Beta, Lda'),
  company('a', 'Alfa, Lda'),
  company('c', 'Gama, Lda', 'gestor'),
];

const employee = (overrides: Partial<MovableEmployee> & { id: string }): MovableEmployee => ({
  name: `Pessoa ${overrides.id}`,
  company_id: 'a',
  user_id: `user-${overrides.id}`,
  is_active: true,
  ...overrides,
});

const effects = (overrides: Partial<PendingEffects> = {}): PendingEffects => ({
  tasks_open_assigned: 0,
  tasks_open_participant: 0,
  events_future_attending: 0,
  events_future_owned: 0,
  folders_assigned: 0,
  chat_conversations_origin: 0,
  ...overrides,
});

const viewer = (user_id: string, kind: CompanyViewer['kind']): CompanyViewer => ({
  user_id,
  name: `Nome ${user_id}`,
  email: `${user_id}@exemplo.invalid`,
  kind,
  role: kind === 'admin_empresa' ? 'admin' : kind,
});

describe('membershipErrorText', () => {
  it('mostra o texto em português da base (details) quando existe', () => {
    const error = new SharingError('invalid_argument', 'Já existe um colaborador com este email.');
    expect(membershipErrorText(error)).toBe('Já existe um colaborador com este email.');
  });

  it('sem details usa a frase geral do código, nunca o código em bruto', () => {
    expect(membershipErrorText(new SharingError('last_admin'))).toBe(
      'A empresa ficaria sem administrador.'
    );
    expect(membershipErrorText(new SharingError('not_found'))).not.toContain('not_found');
  });

  it.each(['not_found', 'invalid_argument', 'last_admin', 'not_company_admin', 'reauth_required'])(
    'o código %s tem sempre uma frase legível',
    code => {
      const text = membershipErrorText(new SharingError(code));
      expect(text).not.toBe(code);
      expect(text.length).toBeGreaterThan(10);
    }
  );

  it('um erro que não é da base dá a frase de erro desconhecido', () => {
    expect(membershipErrorText(new Error('boom'))).toBe(
      'Não foi possível concluir. Tente outra vez.'
    );
  });

  it('ignora um details só com espaços', () => {
    expect(membershipErrorText(new SharingError('not_found', '   '))).toBe(
      'Não encontrado, ou sem direito de o ver.'
    );
  });
});

describe('parse dos resultados', () => {
  const single = {
    employee_id: 'e1',
    from_company: 'a',
    to_company: 'b',
    note: null,
    pending_effects: {
      tasks_open_assigned: 2,
      tasks_open_participant: 0,
      events_future_attending: 1,
      events_future_owned: 0,
      folders_assigned: 3,
      chat_conversations_origin: 4,
    },
  };

  it('aceita o resultado de uma mudança individual', () => {
    const result = parseTransferResult(single);
    expect(result.to_company).toBe('b');
    expect(result.pending_effects.folders_assigned).toBe(3);
  });

  it('trata contagens inválidas como zero', () => {
    const result = parseTransferResult({
      ...single,
      pending_effects: {
        ...single.pending_effects,
        folders_assigned: 'x',
        tasks_open_assigned: -1,
      },
    });
    expect(result.pending_effects.folders_assigned).toBe(0);
    expect(result.pending_effects.tasks_open_assigned).toBe(0);
  });

  it('uma resposta fora do contrato é um erro desconhecido', () => {
    expect(() => parseTransferResult({ employee_id: 'e1' })).toThrow(SharingError);
    expect(() => parseBulkResult(null)).toThrow(SharingError);
  });

  it('aceita o resultado em massa, com itens ok e com erro', () => {
    const result = parseBulkResult({
      total: 2,
      ok: 1,
      failed: 1,
      results: [
        { employee_id: 'e1', ok: true, result: single },
        { employee_id: 'e2', ok: false, error: 'invalid_argument', detail: 'Ficha inativa.' },
      ],
    });
    expect(result.failed).toBe(1);
    expect(result.results[1].ok).toBe(false);
  });
});

describe('bulkItemError e resumo', () => {
  it('mostra o motivo em português da ficha que falhou', () => {
    expect(
      bulkItemError({
        employee_id: 'e2',
        ok: false,
        error: 'invalid_argument',
        detail: 'A ficha do colaborador não está ativa.',
      })
    ).toBe('A ficha do colaborador não está ativa.');
  });

  it('sem texto, usa a frase geral do código', () => {
    expect(bulkItemError({ employee_id: 'e2', ok: false, error: 'not_found' })).toBe(
      'Não encontrado, ou sem direito de o ver.'
    );
  });

  it('resume movidos e erros', () => {
    expect(bulkSummaryText({ ok: 2, failed: 0 })).toBe('2 colaboradores movidos');
    expect(bulkSummaryText({ ok: 1, failed: 1 })).toBe('1 colaborador movido, 1 com erro');
    expect(bulkSummaryText({ ok: 0, failed: 3 })).toBe('3 com erro');
    expect(bulkSummaryText({ ok: 0, failed: 0 })).toBe('Nada foi movido');
  });
});

describe('empresas de destino', () => {
  it('só as empresas que se administra, por ordem de nome (o gestor não conta)', () => {
    expect(manageableCompanies(MINE).map(c => c.company_id)).toEqual(['a', 'b']);
  });

  it('o Super Admin pode mover para qualquer empresa', () => {
    const all = [company('x', 'X', 'super_admin'), company('y', 'Y', 'super_admin')];
    expect(manageableCompanies(all)).toHaveLength(2);
    expect(canManageCompany(all, 'x')).toBe(true);
  });

  it('exclui a empresa atual da ficha', () => {
    expect(transferTargets(MINE, [{ company_id: 'a' }]).map(c => c.company_id)).toEqual(['b']);
  });

  it('em massa, exclui a empresa comum; com origens diferentes não exclui nenhuma', () => {
    expect(commonOrigin([{ company_id: 'a' }, { company_id: 'a' }])).toBe('a');
    expect(commonOrigin([{ company_id: 'a' }, { company_id: 'b' }])).toBeNull();
    expect(
      transferTargets(MINE, [{ company_id: 'a' }, { company_id: 'b' }]).map(c => c.company_id)
    ).toEqual(['a', 'b']);
  });

  it('sem outra empresa para onde mover, a ação não se oferece', () => {
    const only = [company('a', 'Alfa')];
    expect(transferTargets(only, [{ company_id: 'a' }])).toEqual([]);
    expect(canOfferMove(only, { company_id: 'a' })).toBe(false);
  });

  it('a ação só se oferece se se administra a empresa atual', () => {
    expect(canOfferMove(MINE, { company_id: 'a' })).toBe(true);
    expect(canOfferMove(MINE, { company_id: 'c' })).toBe(false); // só gestor
    expect(canOfferMove(MINE, { company_id: 'z' })).toBe(false); // nem pertence
  });
});

describe('splitMovable', () => {
  it('separa as fichas que a base recusaria à partida', () => {
    const { movable, skipped } = splitMovable(
      [
        employee({ id: '1' }),
        employee({ id: '2', is_active: false }),
        employee({ id: '3', user_id: null }),
        employee({ id: '4', company_id: 'z' }),
      ],
      MINE
    );
    expect(movable.map(e => e.id)).toEqual(['1']);
    expect(skipped.map(s => [s.employee.id, s.reason])).toEqual([
      ['2', 'inactive'],
      ['3', 'no_account'],
      ['4', 'not_managed'],
    ]);
  });
});

describe('resumo do que fica por tratar', () => {
  it('só mostra o que tem contagem, em português e com plural', () => {
    const lines = describePendingEffects(
      effects({ tasks_open_assigned: 1, folders_assigned: 3, chat_conversations_origin: 2 })
    );
    expect(lines.map(l => l.text)).toEqual([
      '1 tarefa aberta atribuída',
      '3 pastas atribuídas',
      '2 conversas da empresa anterior (ficam lá)',
    ]);
  });

  it('sem nada por rever não devolve linhas', () => {
    expect(describePendingEffects(effects())).toEqual([]);
  });

  it('soma só as fichas movidas com sucesso', () => {
    const total = sumPendingEffects([
      {
        employee_id: 'e1',
        ok: true,
        result: {
          employee_id: 'e1',
          from_company: 'a',
          to_company: 'b',
          pending_effects: effects({ tasks_open_assigned: 2 }),
        },
      },
      {
        employee_id: 'e2',
        ok: true,
        result: {
          employee_id: 'e2',
          from_company: 'a',
          to_company: 'b',
          pending_effects: effects({ tasks_open_assigned: 1, folders_assigned: 1 }),
        },
      },
      { employee_id: 'e3', ok: false, error: 'invalid_argument' },
    ]);
    expect(total.tasks_open_assigned).toBe(3);
    expect(total.folders_assigned).toBe(1);
  });
});

describe('administradores', () => {
  const viewers = [
    viewer('u1', 'admin_empresa'),
    viewer('u2', 'gestor'),
    viewer('u3', 'super_admin'),
  ];

  it('a equipa da plataforma não se retira aqui', () => {
    expect(canRemoveViewer(viewers[2])).toBe(false);
    expect(canRemoveViewer(viewers[0])).toBe(true);
    expect(canRemoveViewer(viewers[1])).toBe(true);
  });

  it('o único administrador é o último (super admins e gestores não contam)', () => {
    expect(adminCount(viewers)).toBe(1);
    expect(isLastAdmin(viewers, viewers[0])).toBe(true);
    expect(isLastAdmin(viewers, viewers[1])).toBe(false);
  });

  it('com dois administradores nenhum é o último', () => {
    const two = [...viewers, viewer('u4', 'admin_empresa')];
    expect(isLastAdmin(two, two[0])).toBe(false);
    expect(isLastAdmin(two, two[3])).toBe(false);
  });

  it('candidatos: colaboradores ativos com conta que ainda não estão na lista', () => {
    const candidates = adminCandidates(
      [
        { name: 'Zita', email: 'z@x.invalid', user_id: 'u9', is_active: true },
        { name: 'Ana', email: 'a@x.invalid', user_id: 'u8', is_active: true },
        { name: 'Já admin', email: 'j@x.invalid', user_id: 'u1', is_active: true },
        { name: 'Super', email: 's@x.invalid', user_id: 'u3', is_active: true },
        { name: 'Sem conta', email: 'n@x.invalid', user_id: null, is_active: true },
        { name: 'Inativa', email: 'i@x.invalid', user_id: 'u7', is_active: false },
        { name: 'Ana repetida', email: 'a2@x.invalid', user_id: 'u8', is_active: true },
      ],
      viewers
    );
    expect(candidates.map(c => c.userId)).toEqual(['u8', 'u9']);
    expect(candidates[0].name).toBe('Ana');
  });
});

describe('filterByName', () => {
  const people = [{ name: 'José Antunes' }, { name: 'Ana Sá' }, { name: 'Joana Reis' }];

  it('ignora acentos, maiúsculas e espaços à volta', () => {
    expect(filterByName(people, '  jose ')).toEqual([{ name: 'José Antunes' }]);
    expect(filterByName(people, 'SA')).toEqual([{ name: 'Ana Sá' }]);
  });

  it('texto vazio devolve todas, sem alterar a lista original', () => {
    const result = filterByName(people, '   ');
    expect(result).toEqual(people);
    expect(result).not.toBe(people);
  });

  it('sem correspondência devolve vazio', () => {
    expect(filterByName(people, 'zzz')).toEqual([]);
  });
});
