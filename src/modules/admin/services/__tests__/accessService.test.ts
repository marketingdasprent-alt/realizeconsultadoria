import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accessService } from '../accessService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
}

const ok = (data: unknown): QueryResult => ({ data, error: null, status: 200 });
// Resposta do PostgREST enquanto ainda não leu o esquema (depois de reiniciar a BD).
const schemaNotLoaded: QueryResult = {
  data: null,
  error: { code: 'PGRST002', message: 'Could not query the database for the schema cache.' },
  status: 503,
};

/** Simula `from(tabela).select().eq().maybeSingle()` com uma resposta por tabela. */
const mockTables = (results: Record<string, QueryResult>) => {
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve(results[table])),
    };
    return builder;
  }) as unknown as typeof supabase.from);
};

const mockRpc = (result: QueryResult) => {
  vi.mocked(supabase.rpc).mockResolvedValue(result as never);
};

const tablesQueried = () => vi.mocked(supabase.from).mock.calls.map(([table]) => table);

describe('accessService.getUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve o papel da tabela user_roles sem mais pedidos', async () => {
    mockTables({ user_roles: ok({ role: 'admin' }) });

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: 'admin', error: null });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(tablesQueried()).toEqual(['user_roles']);
  });

  it('reconhece o admin pelos grupos', async () => {
    mockTables({ user_roles: ok(null) });
    mockRpc(ok([{ permission: 'employees' }]));

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: 'admin', error: null });
    expect(tablesQueried()).toEqual(['user_roles']);
  });

  it('reconhece o colaborador pela tabela employees', async () => {
    mockTables({ user_roles: ok(null), employees: ok({ id: 'emp-1' }) });
    mockRpc(ok([]));

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: 'employee', error: null });
  });

  it('na área do colaborador, quem é colaborador e admin entra como colaborador', async () => {
    mockTables({ user_roles: ok({ role: 'admin' }), employees: ok({ id: 'emp-1' }) });

    const result = await accessService.getUserRole('user-1', { preferEmployee: true });

    expect(result).toEqual({ data: 'employee', error: null });
    expect(tablesQueried()).toEqual(['employees']);
  });

  it('na área do colaborador, um admin sem ficha continua admin', async () => {
    mockTables({ user_roles: ok({ role: 'admin' }), employees: ok(null) });

    const result = await accessService.getUserRole('user-1', { preferEmployee: true });

    expect(result).toEqual({ data: 'admin', error: null });
    expect(tablesQueried()).toEqual(['employees', 'user_roles']);
  });

  it('conta sem papel → data null e sem erro', async () => {
    mockTables({ user_roles: ok(null), employees: ok(null) });
    mockRpc(ok([]));

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: null, error: null });
  });

  it('503 (PGRST002) devolve erro e pára logo no primeiro pedido', async () => {
    mockTables({ user_roles: schemaNotLoaded, employees: ok({ id: 'emp-1' }) });
    mockRpc(ok([]));

    const result = await accessService.getUserRole('user-1');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(schemaNotLoaded.error);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(tablesQueried()).toEqual(['user_roles']);
  });

  it('503 nos grupos devolve erro sem perguntar à tabela employees', async () => {
    mockTables({ user_roles: ok(null), employees: ok({ id: 'emp-1' }) });
    mockRpc(schemaNotLoaded);

    const result = await accessService.getUserRole('user-1');

    expect(result.error).toEqual(schemaNotLoaded.error);
    expect(tablesQueried()).toEqual(['user_roles']);
  });

  it('503 na tabela employees devolve erro (não é "sem papel")', async () => {
    mockTables({ user_roles: ok(null), employees: schemaNotLoaded });
    mockRpc(ok([]));

    const result = await accessService.getUserRole('user-1');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(schemaNotLoaded.error);
  });

  it('sem rede (status 0) devolve erro', async () => {
    const offline: QueryResult = {
      data: null,
      error: { code: '', message: 'TypeError: Failed to fetch' },
      status: 0,
    };
    mockTables({ user_roles: offline });

    const result = await accessService.getUserRole('user-1');

    expect(result.error).toEqual(offline.error);
  });

  it('erro permanente nos grupos (ex.: função em falta) continua para employees', async () => {
    mockTables({ user_roles: ok(null), employees: ok({ id: 'emp-1' }) });
    mockRpc({ data: null, error: { code: 'PGRST202', message: 'not found' }, status: 404 });

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: 'employee', error: null });
  });

  it('exceção inesperada devolve erro', async () => {
    const failure = new Error('boom');
    vi.mocked(supabase.from).mockImplementation(() => {
      throw failure;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await accessService.getUserRole('user-1');

    expect(result).toEqual({ data: null, error: failure });
    consoleError.mockRestore();
  });
});
