// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CHECK_FAILED,
  COMPANY_FORBIDDEN,
  EMPLOYEE_NOT_FOUND,
  SUPER_ADMIN_ONLY,
  decideCompanyAccess,
  decideEmployeeAccess,
  decideManyCompaniesAccess,
  decideSuperAdminAccess,
  isUuid,
} from '../../../supabase/functions/_shared/company-access';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const adminOf = (...ids: string[]) => vi.fn(async (id: string) => ids.includes(id));

describe('isUuid', () => {
  it('aceita uuid e recusa o resto', () => {
    expect(isUuid(A)).toBe(true);
    expect(isUuid('abc')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(`${A}; drop`)).toBe(false);
  });
});

describe('decideEmployeeAccess', () => {
  it('admin da empresa do alvo passa (inclui super admin, que a RPC aceita em qualquer empresa)', async () => {
    expect(await decideEmployeeAccess(A, adminOf(A))).toEqual({ ok: true });
  });

  it('admin de outra empresa e ficha inexistente dão a mesma resposta 404', async () => {
    const other = await decideEmployeeAccess(B, adminOf(A));
    const missing = await decideEmployeeAccess(null, adminOf(A));
    const undef = await decideEmployeeAccess(undefined, adminOf(A));
    expect(other).toEqual({ ok: false, status: 404, error: EMPLOYEE_NOT_FOUND });
    expect(missing).toEqual(other);
    expect(undef).toEqual(other);
  });

  it('não chama a verificação quando a ficha não existe', async () => {
    const check = adminOf(A);
    await decideEmployeeAccess(null, check);
    expect(check).not.toHaveBeenCalled();
  });

  it('falha da verificação nunca deixa passar', async () => {
    expect(await decideEmployeeAccess(A, async () => null)).toEqual({
      ok: false,
      status: 500,
      error: CHECK_FAILED,
    });
  });
});

describe('decideCompanyAccess', () => {
  it('só passa a empresa que o chamador administra', async () => {
    expect(await decideCompanyAccess(A, adminOf(A))).toEqual({ ok: true });
    expect(await decideCompanyAccess(B, adminOf(A))).toEqual({
      ok: false,
      status: 403,
      error: COMPANY_FORBIDDEN,
    });
  });

  it('company_id em falta ou inválido dá 400 sem consultar a base', async () => {
    const check = adminOf(A);
    for (const bad of [undefined, null, '', 'x', 42, `${A}'--`]) {
      const result = await decideCompanyAccess(bad, check);
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
    expect(check).not.toHaveBeenCalled();
  });

  it('falha da verificação nunca deixa passar', async () => {
    expect(await decideCompanyAccess(A, async () => null)).toMatchObject({
      ok: false,
      status: 500,
    });
  });
});

describe('decideManyCompaniesAccess', () => {
  it('verifica por empresa distinta, não por pessoa', async () => {
    const check = adminOf(A, B);
    const many = [A, A, A, B, B, A];
    expect(await decideManyCompaniesAccess(many, check)).toEqual({ ok: true });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('uma empresa fora do âmbito recusa tudo', async () => {
    expect(await decideManyCompaniesAccess([A, B], adminOf(A))).toEqual({
      ok: false,
      status: 403,
      error: COMPANY_FORBIDDEN,
    });
  });

  it('ficha inexistente (id em falta) conta como fora do âmbito', async () => {
    expect(await decideManyCompaniesAccess([A, null], adminOf(A))).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await decideManyCompaniesAccess([undefined], adminOf(A))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('lista vazia passa (nada a verificar) e falha de verificação recusa', async () => {
    expect(await decideManyCompaniesAccess([], adminOf())).toEqual({ ok: true });
    expect(await decideManyCompaniesAccess([A], async () => null)).toMatchObject({
      ok: false,
      status: 500,
    });
  });
});

describe('decideSuperAdminAccess', () => {
  it('só super admin passa', () => {
    expect(decideSuperAdminAccess(true)).toEqual({ ok: true });
    expect(decideSuperAdminAccess(false)).toEqual({
      ok: false,
      status: 403,
      error: SUPER_ADMIN_ONLY,
    });
    expect(decideSuperAdminAccess(null)).toMatchObject({ ok: false, status: 500 });
  });
});

describe('casos adicionais (QA D1)', () => {
  it('ficha com company_id que não é uuid dá 404 sem consultar a base', async () => {
    const check = adminOf(A);
    expect(await decideEmployeeAccess('não-é-uuid', check)).toEqual({
      ok: false,
      status: 404,
      error: EMPLOYEE_NOT_FOUND,
    });
    expect(check).not.toHaveBeenCalled();
  });

  it('admin de outra empresa nunca passa, mesmo que a RPC responda false para todas', async () => {
    const check = adminOf();
    expect(await decideEmployeeAccess(A, check)).toMatchObject({ ok: false, status: 404 });
    expect(await decideCompanyAccess(A, check)).toMatchObject({ ok: false, status: 403 });
    expect(await decideManyCompaniesAccess([A], check)).toMatchObject({ ok: false, status: 403 });
  });

  it('2000 pessoas de 2 empresas fazem só 2 verificações (limite do broadcast/remind)', async () => {
    const check = adminOf(A, B);
    const ids = Array.from({ length: 2000 }, (_, i) => (i % 2 ? A : B));
    expect(await decideManyCompaniesAccess(ids, check)).toEqual({ ok: true });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('2000 pessoas com uma só de empresa fora do âmbito recusam tudo', async () => {
    const ids = [...Array.from({ length: 1999 }, () => A), B];
    expect(await decideManyCompaniesAccess(ids, adminOf(A))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('para à primeira empresa recusada (não continua a consultar)', async () => {
    const check = adminOf();
    await decideManyCompaniesAccess([A, B], check);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('falha da verificação numa empresa a meio recusa tudo (500, nunca passa)', async () => {
    const check = vi.fn(async (id: string) => (id === A ? true : null));
    expect(await decideManyCompaniesAccess([A, B], check)).toMatchObject({
      ok: false,
      status: 500,
      error: CHECK_FAILED,
    });
  });

  it('aviso global (company_id nulo) só passa se for tratado como super admin: null recusa', async () => {
    // O broadcast trata null como fora do âmbito; super admin decide-se à parte
    expect(await decideManyCompaniesAccess([null], adminOf(A, B))).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(decideSuperAdminAccess(false)).toMatchObject({ ok: false, status: 403 });
  });

  it('uma verificação que rejeita (exceção) não devolve ok', async () => {
    const boom = async () => {
      throw new Error('rede');
    };
    await expect(decideEmployeeAccess(A, boom)).rejects.toThrow();
    await expect(decideCompanyAccess(A, boom)).rejects.toThrow();
    await expect(decideManyCompaniesAccess([A], boom)).rejects.toThrow();
  });

  it('mensagens de recusa não contêm detalhes internos', () => {
    for (const msg of [EMPLOYEE_NOT_FOUND, COMPANY_FORBIDDEN, SUPER_ADMIN_ONLY, CHECK_FAILED]) {
      expect(msg).not.toMatch(/rz_|rpc|sql|postgres|uuid|service|key/i);
    }
  });
});
