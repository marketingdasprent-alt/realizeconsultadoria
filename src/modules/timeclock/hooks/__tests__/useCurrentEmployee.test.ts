import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getCurrentEmployee = vi.hoisted(() => vi.fn());
vi.mock('../../services/timeClockService', () => ({
  timeClockService: { getCurrentEmployee },
}));

import { readDeviceCache } from '@/lib/device-cache';
import { useCurrentEmployee } from '../useCurrentEmployee';

const session = (userId: string) =>
  localStorage.setItem('sb-proj-auth-token', JSON.stringify({ user: { id: userId } }));

describe('useCurrentEmployee', () => {
  afterEach(() => {
    localStorage.clear();
    getCurrentEmployee.mockReset();
  });

  it('guarda o colaborador na cache de quem fez o pedido', async () => {
    session('u1');
    getCurrentEmployee.mockResolvedValue({ data: { id: 'e1' }, error: null });

    const { result } = renderHook(() => useCurrentEmployee());
    await waitFor(() => expect(result.current.employee).toEqual({ id: 'e1' }));

    expect(readDeviceCache('current-employee', 'u1')).toEqual({ id: 'e1' });
  });

  it('se a conta mudar durante o pedido, a resposta da anterior não é usada nem guardada', async () => {
    session('u1');
    let answer: (value: unknown) => void = () => undefined;
    getCurrentEmployee.mockReturnValue(new Promise(resolve => (answer = resolve)));

    const { result } = renderHook(() => useCurrentEmployee());
    session('u2');
    await act(async () => answer({ data: { id: 'e-da-conta-1' }, error: null }));

    expect(result.current.employee).toBeNull();
    expect(readDeviceCache('current-employee', 'u1')).toBeNull();
    expect(readDeviceCache('current-employee', 'u2')).toBeNull();
  });
});
