// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CHECK_FAILED,
  COMPANY_FORBIDDEN,
  EMPLOYEE_NOT_FOUND,
  SUPER_ONLY_BROADCAST,
  broadcastScope,
  decideScope,
  decideTargetAccountAccess,
  shouldBanAccount,
  remindScope,
} from '../../../supabase/functions/_shared/company-access';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const adminOf = (...ids: string[]) => vi.fn(async (id: string) => ids.includes(id));
const NOT_FOUND = { ok: false, status: 404, error: EMPLOYEE_NOT_FOUND };

const plain = {
  isPlatformAdmin: false,
  hasAdminRole: false,
  inAdminGroup: false,
  inSuperAdminGroup: false,
  adminCompanyIds: [] as string[],
  memberCompanyIds: [] as string[],
};

describe('decideTargetAccountAccess (A2: ficha que aponta para conta com poderes)', () => {
  it('conta de colaborador normal passa', async () => {
    expect(await decideTargetAccountAccess(false, plain, adminOf(A))).toEqual({ ok: true });
  });

  it('admin de A sobre ficha cujo user_id é admin de B = 404 igual ao inexistente', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, adminCompanyIds: [B] },
      adminOf(A)
    );
    expect(result).toEqual(NOT_FOUND);
  });

  it('admin de A sobre conta que só é admin de A passa (colaborador-admin da mesma empresa)', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, adminCompanyIds: [A] },
      adminOf(A)
    );
    expect(result).toEqual({ ok: true });
  });

  it('conta admin de A e de B: o chamador tem de administrar as duas', async () => {
    const facts = { ...plain, adminCompanyIds: [A, B] };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual(NOT_FOUND);
    expect(await decideTargetAccountAccess(false, facts, adminOf(A, B))).toEqual({ ok: true });
  });

  it('super admin como alvo = 404 para quem não é super admin', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, isPlatformAdmin: true, adminCompanyIds: [A] },
      adminOf(A)
    );
    expect(result).toEqual(NOT_FOUND);
  });

  it('user_roles.admin sem pertença de admin = fora do âmbito (404)', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, hasAdminRole: true },
      adminOf(A)
    );
    expect(result).toEqual(NOT_FOUND);
  });

  it('user_roles.admin com pertença admin só de A passa para o admin de A', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, hasAdminRole: true, adminCompanyIds: [A] },
      adminOf(A)
    );
    expect(result).toEqual({ ok: true });
  });

  it('chamador super admin passa sempre, sem consultar a base', async () => {
    const check = adminOf();
    const result = await decideTargetAccountAccess(
      true,
      {
        ...plain,
        isPlatformAdmin: true,
        hasAdminRole: true,
        adminCompanyIds: [A, B],
        memberCompanyIds: [A, B],
      },
      check
    );
    expect(result).toEqual({ ok: true });
    expect(check).not.toHaveBeenCalled();
  });

  it('falha da verificação nunca deixa passar', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, adminCompanyIds: [A] },
      async () => null
    );
    expect(result).toEqual({ ok: false, status: 500, error: CHECK_FAILED });
  });
});

describe('decideTargetAccountAccess: pertenças e grupos de admin', () => {
  it('ficha de A com user_id de colaborador normal de B = 404', async () => {
    const facts = { ...plain, memberCompanyIds: [B] };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual(NOT_FOUND);
  });

  it('colaborador de A e B: 404 para admin só de A, passa para admin de A e B', async () => {
    const facts = { ...plain, memberCompanyIds: [A, B] };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual(NOT_FOUND);
    expect(await decideTargetAccountAccess(false, facts, adminOf(A, B))).toEqual({ ok: true });
  });

  it('ficha de A com alvo só de A passa (colaborador e admin)', async () => {
    expect(
      await decideTargetAccountAccess(false, { ...plain, memberCompanyIds: [A] }, adminOf(A))
    ).toEqual({ ok: true });
    expect(
      await decideTargetAccountAccess(
        false,
        { ...plain, adminCompanyIds: [A], memberCompanyIds: [A] },
        adminOf(A)
      )
    ).toEqual({ ok: true });
  });

  it('alvo sem nenhuma pertença passa (vale a verificação da empresa da ficha)', async () => {
    const check = adminOf(A);
    expect(await decideTargetAccountAccess(false, plain, check)).toEqual({ ok: true });
    expect(check).not.toHaveBeenCalled();
  });

  it('alvo em grupo de admin ativo sem pertença de admin = 404', async () => {
    const facts = { ...plain, inAdminGroup: true };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual(NOT_FOUND);
  });

  it('grupo de admin com pertença de admin só em A passa para o admin de A', async () => {
    const facts = { ...plain, inAdminGroup: true, adminCompanyIds: [A], memberCompanyIds: [A] };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual({ ok: true });
  });

  it('grupo super admin = 404 mesmo com pertença só em A; super admin chamador passa', async () => {
    const facts = {
      ...plain,
      inAdminGroup: true,
      inSuperAdminGroup: true,
      adminCompanyIds: [A],
      memberCompanyIds: [A],
    };
    expect(await decideTargetAccountAccess(false, facts, adminOf(A))).toEqual(NOT_FOUND);
    expect(await decideTargetAccountAccess(true, facts, adminOf())).toEqual({ ok: true });
  });

  it('falha da RPC numa pertença de colaborador = 500', async () => {
    const result = await decideTargetAccountAccess(
      false,
      { ...plain, memberCompanyIds: [A] },
      async () => null
    );
    expect(result).toEqual({ ok: false, status: 500, error: CHECK_FAILED });
  });
});

describe('shouldBanAccount (delete-employee)', () => {
  it('só bane quando a conta não tem outra ficha ativa nem outra pertença ativa', () => {
    expect(shouldBanAccount(0, 0)).toBe(true);
    expect(shouldBanAccount(1, 0)).toBe(false);
    expect(shouldBanAccount(0, 1)).toBe(false);
    expect(shouldBanAccount(2, 3)).toBe(false);
  });
});

describe('broadcastScope', () => {
  const base = {
    test: false,
    publishInApp: false,
    audienceMode: 'people',
    audienceCompanyIds: [] as string[],
    peopleCompanyIds: [A, A, B],
  };

  it('junta as empresas dos destinatários', () => {
    expect(broadcastScope(base)).toEqual({ companyIds: [A, A, B], needsSuperAdmin: false });
  });

  it('modo empresa junta audience.companyIds; outros modos ignoram-nas', () => {
    expect(
      broadcastScope({ ...base, audienceMode: 'company', audienceCompanyIds: [C] }).companyIds
    ).toEqual([A, A, B, C]);
    expect(broadcastScope({ ...base, audienceCompanyIds: [C] }).companyIds).toEqual([A, A, B]);
  });

  it('modo "todos" com publicação na app só para super admin; sem publicação não', () => {
    expect(
      broadcastScope({ ...base, audienceMode: 'all', publishInApp: true }).needsSuperAdmin
    ).toBe(true);
    expect(broadcastScope({ ...base, audienceMode: 'all' }).needsSuperAdmin).toBe(false);
  });

  it('teste: só vai para o próprio, sem âmbito a verificar', () => {
    expect(
      broadcastScope({ ...base, test: true, audienceMode: 'all', publishInApp: true })
    ).toEqual({ companyIds: [], needsSuperAdmin: false });
  });

  it('destinatário sem empresa (nulo) fica na lista para recusar', () => {
    expect(broadcastScope({ ...base, peopleCompanyIds: [null] }).companyIds).toEqual([null]);
  });
});

describe('remindScope', () => {
  const noticeOfCompany = { company_id: A, employee_id: null };
  const noticeOfPerson = { company_id: null, employee_id: 'e1' };
  const noticeGlobal = { company_id: null, employee_id: null };

  it('junta as empresas das pessoas e dos avisos', () => {
    const scope = remindScope({
      peopleCompanyIds: [A],
      notices: [noticeOfCompany, noticeOfPerson],
      requestedNotices: 2,
      companyOfEmployee: new Map([['e1', B]]),
    });
    expect(scope).toEqual({
      companyIds: [A, A, B],
      needsSuperAdmin: false,
      unknownNotice: false,
    });
  });

  it('aviso global só para super admin', () => {
    const scope = remindScope({
      peopleCompanyIds: [A],
      notices: [noticeGlobal],
      requestedNotices: 1,
      companyOfEmployee: new Map(),
    });
    expect(scope.needsSuperAdmin).toBe(true);
  });

  it('aviso inexistente (menos linhas que pedidos) fica marcado', () => {
    const scope = remindScope({
      peopleCompanyIds: [A],
      notices: [noticeOfCompany],
      requestedNotices: 2,
      companyOfEmployee: new Map(),
    });
    expect(scope.unknownNotice).toBe(true);
  });

  it('aviso por pessoa cuja ficha não existe conta como empresa nula (recusa)', () => {
    const scope = remindScope({
      peopleCompanyIds: [],
      notices: [noticeOfPerson],
      requestedNotices: 1,
      companyOfEmployee: new Map(),
    });
    expect(scope.companyIds).toEqual([null]);
  });
});

describe('decideScope', () => {
  const noSuper = async () => false;
  const yesSuper = async () => true;

  it('tudo dentro do âmbito passa', async () => {
    const scope = { companyIds: [A, B], needsSuperAdmin: false };
    expect(await decideScope(scope, adminOf(A, B), noSuper)).toEqual({ ok: true });
  });

  it('uma empresa fora do âmbito recusa tudo', async () => {
    const scope = { companyIds: [A, B], needsSuperAdmin: false };
    expect(await decideScope(scope, adminOf(A), noSuper)).toEqual({
      ok: false,
      status: 403,
      error: COMPANY_FORBIDDEN,
    });
  });

  it('exige super admin quando o âmbito o pede, com mensagem própria', async () => {
    const scope = { companyIds: [A], needsSuperAdmin: true };
    expect(await decideScope(scope, adminOf(A), noSuper)).toEqual({
      ok: false,
      status: 403,
      error: SUPER_ONLY_BROADCAST,
    });
    expect(await decideScope(scope, adminOf(A), yesSuper)).toEqual({ ok: true });
  });

  it('aviso inexistente recusa com a mesma resposta de fora do âmbito', async () => {
    const scope = { companyIds: [A], needsSuperAdmin: false, unknownNotice: true };
    expect(await decideScope(scope, adminOf(A), yesSuper)).toEqual({
      ok: false,
      status: 403,
      error: COMPANY_FORBIDDEN,
    });
  });

  it('falha ao verificar super admin recusa (500) e exceção não passa', async () => {
    const scope = { companyIds: [], needsSuperAdmin: true };
    expect(await decideScope(scope, adminOf(), async () => null)).toMatchObject({
      ok: false,
      status: 500,
    });
    await expect(
      decideScope(scope, adminOf(), async () => {
        throw new Error('rede');
      })
    ).rejects.toThrow();
  });
});
