import { beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeService } from '../badgeService';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '@/integrations/supabase/client';

interface Call {
  table: string;
  select: string;
  filters: [string, string, unknown][];
}

const mockDb = () => {
  const calls: Call[] = [];
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const call: Call = { table, select: '', filters: [] };
    calls.push(call);
    const result = { count: 3, data: null, error: null };
    const builder: Record<string, unknown> = {
      select: vi.fn((columns: string) => ((call.select = columns), builder)),
      eq: vi.fn(() => builder),
      or: vi.fn(() => builder),
      in: vi.fn((col: string, val: unknown) => (call.filters.push(['in', col, val]), builder)),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }) as unknown as typeof supabase.from);
  return calls;
};

const companyFilterOf = (calls: Call[], table: string) =>
  calls
    .find(c => c.table === table)
    ?.filters.find(([, col]) => col === 'company_id' || col === 'employees.company_id');

describe('badgeService.counts: os números do menu seguem a empresa ou grupo escolhido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('com uma escolha, documentos, pedidos e tickets limitam-se às empresas dela', async () => {
    const calls = mockDb();
    await badgeService.counts(['c1', 'c2']);
    // documentos: a empresa vem da ficha do colaborador
    expect(calls.find(c => c.table === 'employee_documents')?.select).toContain('employees!inner');
    expect(companyFilterOf(calls, 'employee_documents')).toEqual([
      'in',
      'employees.company_id',
      ['c1', 'c2'],
    ]);
    expect(companyFilterOf(calls, 'absences')).toEqual(['in', 'company_id', ['c1', 'c2']]);
    expect(companyFilterOf(calls, 'support_tickets')).toEqual(['in', 'company_id', ['c1', 'c2']]);
  });

  it('"Todas as empresas" não acrescenta limite de empresa', async () => {
    const calls = mockDb();
    await badgeService.counts(null);
    expect(calls.flatMap(c => c.filters).some(([, col]) => /company_id/.test(col))).toBe(false);
  });

  it('uma escolha sem empresas visíveis dá zeros', async () => {
    const calls = mockDb();
    const { data } = await badgeService.counts([]);
    expect(data).toEqual({ pendingDocuments: 0, pendingRequests: 0, openTickets: 0 });
    expect(calls).toHaveLength(0);
  });
});
