import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listPeople = vi.fn();
vi.mock('../../services/feedService', () => ({
  feedService: { listPeople: (id: string) => listPeople(id) },
}));
vi.mock('../useDirectory', () => ({
  useDirectory: () => ({
    nameOf: (id: string | null) => (id === 'u-mine' ? 'Rui da Minha' : 'Antigo colaborador'),
  }),
}));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false, user: { userId: 'u1' } }),
}));

import { useFeedPeople } from '../useFeedPeople';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useFeedPeople', () => {
  beforeEach(() => listPeople.mockReset());

  it('resolve "Nome - Empresa" para quem o diretório não tem', async () => {
    listPeople.mockResolvedValue({
      data: [
        { user_id: 'u2', name: 'Beatriz Matias', company_id: 'c2', company_name: 'Razão Dinâmica' },
      ],
      error: null,
    });
    const { result } = renderHook(() => useFeedPeople('p1', 'Razão Dinâmica'), { wrapper });
    await waitFor(() =>
      expect(result.current.labelOf('u2')).toBe('Beatriz Matias - Razão Dinâmica')
    );
    expect(listPeople).toHaveBeenCalledWith('p1');
  });

  it('quem o diretório conhece mantém o nome do diretório', async () => {
    listPeople.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useFeedPeople('p1', 'Razão Dinâmica'), { wrapper });
    await waitFor(() => expect(listPeople).toHaveBeenCalled());
    expect(result.current.labelOf('u-mine')).toBe('Rui da Minha');
  });

  it('base antiga (função inexistente): cai no rótulo genérico, sem erro', async () => {
    listPeople.mockResolvedValue({ data: [], error: { code: '42883', message: 'does not exist' } });
    const { result } = renderHook(() => useFeedPeople('p1', 'Razão Dinâmica'), { wrapper });
    await waitFor(() => expect(listPeople).toHaveBeenCalled());
    expect(result.current.labelOf('u2')).toBe('Colaborador · Razão Dinâmica');
  });

  it('publicação da própria empresa: não vai buscar nada', () => {
    const { result } = renderHook(() => useFeedPeople('p1', null), { wrapper });
    expect(listPeople).not.toHaveBeenCalled();
    expect(result.current.labelOf('u2')).toBe('Antigo colaborador');
  });
});
