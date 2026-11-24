import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timeClockService } from '../timeClockService';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '@/integrations/supabase/client';

interface Call {
  table: string;
  select: string;
  filters: [string, unknown][];
  limit: number | null;
}

const mockDb = () => {
  const calls: Call[] = [];
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const call: Call = { table, select: '', filters: [], limit: null };
    calls.push(call);
    const result = { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: vi.fn((columns: string) => ((call.select = columns), builder)),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn((n: number) => ((call.limit = n), builder)),
      in: vi.fn((col: string, val: unknown) => (call.filters.push([col, val]), builder)),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }) as unknown as typeof supabase.from);
  return calls;
};

describe('timeClockService: o âmbito entra na consulta (antes do limite de 500)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tentativas: com empresas escolhidas, filtra pela empresa do colaborador', async () => {
    const calls = mockDb();
    await timeClockService.getAttempts('2026-11-01', '2026-11-30', ['c1', 'c2']);
    expect(calls[0].select).toContain('employees!inner');
    expect(calls[0].filters).toEqual([['employee.company_id', ['c1', 'c2']]]);
  });

  it('tentativas: sem escolha não filtra nem exige colaborador', async () => {
    const calls = mockDb();
    await timeClockService.getAttempts('2026-11-01', '2026-11-30');
    expect(calls[0].select).not.toContain('!inner');
    expect(calls[0].filters).toEqual([]);
  });

  it('histórico: com colaboradores da escolha, filtra por eles', async () => {
    const calls = mockDb();
    await timeClockService.getHistory({ fromIso: '2026-11-01', employeeIds: ['e1', 'e2'] });
    expect(calls[0].filters).toEqual([['employee_id', ['e1', 'e2']]]);
  });

  it('histórico: escolha sem colaboradores não consulta a base', async () => {
    const calls = mockDb();
    const { data } = await timeClockService.getHistory({ fromIso: '2026-11-01', employeeIds: [] });
    expect(data).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('histórico: sem escolha não filtra por colaborador', async () => {
    const calls = mockDb();
    await timeClockService.getHistory({ fromIso: '2026-11-01' });
    expect(calls[0].filters).toEqual([]);
  });
});
