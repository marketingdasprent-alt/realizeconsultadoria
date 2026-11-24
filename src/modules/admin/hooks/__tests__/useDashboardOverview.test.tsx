import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardOverview } from '../useDashboardOverview';

const getOverview = vi.hoisted(() => vi.fn());
vi.mock('../../services/dashboardService', () => ({ dashboardService: { getOverview } }));

const scope = vi.hoisted(() => ({
  value: { scope: 'all', ids: null as Set<string> | null, isLoading: false },
}));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope.value }));

const overview = {
  totalCompanies: 1,
  totalEmployees: 2,
  pendingAbsences: 0,
  openTickets: 0,
  absentToday: [],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useDashboardOverview: segue o seletor de empresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOverview.mockResolvedValue({ data: overview, error: null });
    scope.value = { scope: 'all', ids: null, isLoading: false };
  });

  it('"Todas as empresas": pede os números sem limite', async () => {
    renderHook(() => useDashboardOverview(), { wrapper });
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith(null));
  });

  it('com um grupo escolhido, pede só as empresas do grupo', async () => {
    scope.value = { scope: 'g:urbango', ids: new Set(['c1', 'c2']), isLoading: false };
    renderHook(() => useDashboardOverview(), { wrapper });
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith(['c1', 'c2']));
  });

  it('enquanto o seletor carrega não pede nada (evita mostrar o total por um instante)', async () => {
    scope.value = { scope: 'c:c1', ids: null, isLoading: true };
    renderHook(() => useDashboardOverview(), { wrapper });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getOverview).not.toHaveBeenCalled();
  });

  it('trocar de escolha volta a pedir (a cache é por escolha)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const shared = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(() => useDashboardOverview(), { wrapper: shared });
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith(null));

    scope.value = { scope: 'c:c9', ids: new Set(['c9']), isLoading: false };
    rerender();
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith(['c9']));
    expect(getOverview).toHaveBeenCalledTimes(2);
  });
});
