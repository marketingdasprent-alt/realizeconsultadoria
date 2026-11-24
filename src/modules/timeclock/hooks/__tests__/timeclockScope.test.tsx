import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeClockLocations } from '../useTimeClockLocations';
import { useTimeClockReview } from '../useTimeClockReview';
import { useTimesheet } from '../useTimesheet';
import { useTodayBoard } from '../useTodayBoard';

const svc = vi.hoisted(() => ({
  getEntries: vi.fn(),
  getAttempts: vi.fn(),
  getBoard: vi.fn(),
  getLocations: vi.fn(),
}));
vi.mock('../../services/timeClockService', () => ({
  timeClockService: { getEntries: svc.getEntries, getAttempts: svc.getAttempts },
}));
vi.mock('../../services/todayBoardService', () => ({
  todayBoardService: { getBoard: svc.getBoard },
}));
vi.mock('../../services/timeClockLocationService', () => ({
  timeClockLocationService: { getAll: svc.getLocations },
}));
vi.mock('../useHourBank', () => ({ useHourBank: () => ({ bankFor: () => null }) }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('@/modules/admin/context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const entry = (id: string, company: string) => ({
  id,
  employee_id: `emp-${id}`,
  company_id: company,
  status: 'pending',
  entry_type: 'in',
  punched_at: '2026-11-20T09:00:00Z',
  employee: { id: `emp-${id}`, name: `Pessoa ${id}`, company_id: company },
});
const ENTRIES = [entry('a', 'c1'), entry('b', 'c2'), entry('c', 'c3')];

describe('Ponto: os dados seguem o seletor de empresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scope.ids = null;
    svc.getEntries.mockResolvedValue({ data: ENTRIES, error: null });
    svc.getAttempts.mockResolvedValue({
      data: ENTRIES.map(e => ({
        id: `t-${e.id}`,
        employee: { name: 'x', company_id: e.company_id },
      })),
      error: null,
    });
  });

  describe('Revisão', () => {
    it('"Todas as empresas": todos os registos e tentativas', async () => {
      const { result } = renderHook(() => useTimeClockReview(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.pending).toHaveLength(3);
      expect(result.current.attempts).toHaveLength(3);
    });

    it('com um grupo escolhido, só registos e tentativas das empresas do grupo', async () => {
      scope.ids = new Set(['c1', 'c3']);
      const { result } = renderHook(() => useTimeClockReview(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.pending.map(e => e.id).sort()).toEqual(['a', 'c']);
      expect(result.current.flagged.map(e => e.id).sort()).toEqual(['a', 'c']);
      expect(result.current.attempts.map(a => a.id).sort()).toEqual(['t-a', 't-c']);
    });
  });

  describe('Folha de ponto', () => {
    const filters = {
      month: new Date('2026-11-01T00:00:00Z'),
      companyId: null,
      employeeId: null,
      onlyFlagged: false,
    };

    it('com uma empresa escolhida, só os registos dela', async () => {
      scope.ids = new Set(['c2']);
      const { result } = renderHook(() => useTimesheet(filters), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.entries.map(e => e.id)).toEqual(['b']);
      expect(result.current.sheets.map(s => s.employeeId)).toEqual(['emp-b']);
    });

    it('"Todas as empresas": todos', async () => {
      const { result } = renderHook(() => useTimesheet(filters), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.entries).toHaveLength(3);
    });
  });

  describe('Hoje', () => {
    const emp = (id: string, company: string) => ({
      id,
      name: id,
      userId: null,
      companyId: company,
      companyName: company,
    });
    beforeEach(() => {
      svc.getBoard.mockResolvedValue({
        data: {
          employees: [emp('p1', 'c1'), emp('p2', 'c2')],
          entries: [],
          regulars: new Set(['p1', 'p2']),
          absences: new Map(),
        },
        error: null,
      });
    });

    it('com uma empresa escolhida, só as pessoas dela', async () => {
      scope.ids = new Set(['c2']);
      const { result } = renderHook(() => useTodayBoard(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.people.map(p => p.employee.id)).toEqual(['p2']);
    });

    it('"Todas as empresas": todas', async () => {
      const { result } = renderHook(() => useTodayBoard(), { wrapper });
      await waitFor(() => expect(result.current.people).toHaveLength(2));
    });
  });

  describe('Locais e tags', () => {
    beforeEach(() => {
      svc.getLocations.mockResolvedValue({
        data: [
          { id: 'l1', company_id: 'c1' },
          { id: 'l2', company_id: 'c2' },
        ],
        error: null,
      });
    });

    it('com uma empresa escolhida, só os locais dela', async () => {
      scope.ids = new Set(['c1']);
      const { result } = renderHook(() => useTimeClockLocations(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.locations.map(l => l.id)).toEqual(['l1']);
    });

    it('"Todas as empresas": todos', async () => {
      const { result } = renderHook(() => useTimeClockLocations(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.locations).toHaveLength(2);
    });
  });
});
