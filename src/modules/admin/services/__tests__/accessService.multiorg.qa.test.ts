import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accessService } from '../accessService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';

interface Res {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
}
const ok = (data: unknown): Res => ({ data, error: null, status: 200 });
const down: Res = {
  data: null,
  error: { code: 'PGRST002', message: 'schema cache' },
  status: 503,
};

const mockTables = (results: Record<string, Res>) => {
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      maybeSingle: vi.fn(() => Promise.resolve(results[table] ?? ok(null))),
    };
    return b;
  }) as unknown as typeof supabase.from);
};

/** rpc por nome: get_admin_permissions e rz_my_admin_company_ids. */
const mockRpcs = (rpcs: { perms: Res; companies: Res }) => {
  vi.mocked(supabase.rpc).mockImplementation(((fn: string) =>
    Promise.resolve(
      fn === 'rz_my_admin_company_ids' ? rpcs.companies : rpcs.perms
    )) as unknown as typeof supabase.rpc);
};

describe('QA multi-org PR1: accessService (papéis)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin só de empresa (pertença admin, sem user_roles nem grupos) é admin', async () => {
    mockTables({ user_roles: ok(null) });
    mockRpcs({ perms: ok([]), companies: ok(['empresa-a']) });
    expect(await accessService.getUserRole('u')).toEqual({ data: 'admin', error: null });
    expect(await accessService.checkAdminRole('u')).toEqual({ isAdmin: true, error: null });
  });

  it('colaborador (sem pertença admin) NÃO é admin e fica como employee', async () => {
    mockTables({ user_roles: ok(null), employees: ok({ id: 'e1' }) });
    mockRpcs({ perms: ok([]), companies: ok([]) });
    expect(await accessService.getUserRole('u')).toEqual({ data: 'employee', error: null });
    expect(await accessService.checkAdminRole('u')).toEqual({ isAdmin: false, error: null });
  });

  it('conta sem papel nenhum: sem papel', async () => {
    mockTables({ user_roles: ok(null), employees: ok(null) });
    mockRpcs({ perms: ok([]), companies: ok([]) });
    expect(await accessService.getUserRole('u')).toEqual({ data: null, error: null });
  });

  // HIGH da Visão (accessService.ts:12-16, :120-122): falha de rede no RPC não pode valer "sem papel",
  // porque a app faz logout a quem não tem papel.
  it('falha transitória em rz_my_admin_company_ids propaga o erro (não vira "sem papel")', async () => {
    mockTables({ user_roles: ok(null), employees: ok(null) });
    mockRpcs({ perms: ok([]), companies: down });
    const r = await accessService.getUserRole('u');
    expect(r.error).not.toBeNull();
    expect(r.data).toBeNull();
  });

  it('falha transitória em rz_my_admin_company_ids em checkAdminRole devolve o erro', async () => {
    mockTables({ user_roles: ok(null) });
    mockRpcs({ perms: ok([]), companies: down });
    const r = await accessService.checkAdminRole('u');
    expect(r.error).not.toBeNull();
  });
});
