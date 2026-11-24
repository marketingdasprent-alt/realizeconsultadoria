import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardService } from '../dashboardService';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '@/integrations/supabase/client';

interface Call {
  table: string;
  filters: [string, string, unknown][];
}

/** Regista cada consulta (tabela + filtros) e devolve contagens e linhas fixas. */
const mockDb = (absences: unknown[] = []) => {
  const calls: Call[] = [];
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const call: Call = { table, filters: [] };
    calls.push(call);
    const result = { count: 7, data: table === 'absences' ? absences : [], error: null };
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: unknown) => (call.filters.push(['eq', col, val]), builder)),
      in: vi.fn((col: string, val: unknown) => (call.filters.push(['in', col, val]), builder)),
      lte: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }) as unknown as typeof supabase.from);
  return calls;
};

const companyFilter = (calls: Call[], table: string, column: string) =>
  calls
    .filter(c => c.table === table)
    .map(c => c.filters.find(([op, col]) => op === 'in' && col === column)?.[2]);

describe('dashboardService.getOverview: respeita a empresa ou o grupo escolhido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('com uma escolha, cada contagem limita-se às empresas dela', async () => {
    const calls = mockDb();
    await dashboardService.getOverview(['urbango-1', 'urbango-2']);

    const ids = ['urbango-1', 'urbango-2'];
    expect(companyFilter(calls, 'companies', 'id')).toEqual([ids]);
    expect(companyFilter(calls, 'employees', 'company_id')).toEqual([ids]);
    // pedidos pendentes e ausentes hoje: duas consultas a absences
    expect(companyFilter(calls, 'absences', 'company_id')).toEqual([ids, ids]);
    expect(companyFilter(calls, 'support_tickets', 'company_id')).toEqual([ids]);
  });

  it('"Todas as empresas" (sem escolha) não acrescenta nenhum limite de empresa', async () => {
    const calls = mockDb();
    await dashboardService.getOverview(null);
    const companyFilters = calls
      .flatMap(c => c.filters)
      .filter(([op, col]) => op === 'in' && (col === 'company_id' || col === 'id'));
    expect(companyFilters).toEqual([]);
  });

  it('uma escolha sem empresas visíveis dá zeros sem consultar a base', async () => {
    const calls = mockDb();
    const { data, error } = await dashboardService.getOverview([]);
    expect(error).toBeNull();
    expect(data).toEqual({
      totalCompanies: 0,
      totalEmployees: 0,
      pendingAbsences: 0,
      openTickets: 0,
      absentToday: [],
    });
    expect(calls).toHaveLength(0);
  });

  it('devolve os números que a base deu para a escolha', async () => {
    mockDb();
    const { data } = await dashboardService.getOverview(['c1']);
    expect(data).toMatchObject({ totalCompanies: 7, totalEmployees: 7 });
  });
});
