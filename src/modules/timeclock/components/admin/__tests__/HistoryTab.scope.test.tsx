import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryTab } from '../HistoryTab';

const item = (id: string, employee: string) => ({
  id,
  entry_id: `en-${id}`,
  employee_id: employee,
  action: 'update',
  new_data: null,
});

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: () => ({
    employees: [
      { id: 'e1', name: 'Ana', company_id: 'c1' },
      { id: 'e2', name: 'Rui', company_id: 'c2' },
    ],
  }),
}));
vi.mock('../../../hooks/useTimeClockHistory', () => ({
  useTimeClockHistory: () => ({
    items: [item('h1', 'e1'), item('h2', 'e2')],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../../../hooks/useTimeClockConfigHistory', () => ({
  useTimeClockConfigHistory: () => ({ items: [], isLoading: false, error: null }),
}));

const list = vi.hoisted(() => ({ items: [] as { id: string }[] }));
vi.mock('../HistoryChangeList', () => ({
  HistoryChangeList: (props: { items: { id: string }[] }) => {
    list.items = props.items;
    return null;
  },
}));
vi.mock('../ConfigHistoryList', () => ({ ConfigHistoryList: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('@/modules/admin/context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

describe('Ponto → Histórico: segue o seletor de empresa', () => {
  beforeEach(() => {
    list.items = [];
    scope.ids = null;
  });

  it('"Todas as empresas": todas as alterações', () => {
    render(<HistoryTab />);
    expect(list.items.map(i => i.id)).toEqual(['h1', 'h2']);
  });

  it('com uma empresa escolhida, só as alterações de quem é dela', () => {
    scope.ids = new Set(['c2']);
    render(<HistoryTab />);
    expect(list.items.map(i => i.id)).toEqual(['h2']);
  });
});
