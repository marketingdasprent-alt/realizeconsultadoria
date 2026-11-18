import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SharingError } from '../../lib/sharing';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), refresh: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../useSharing', () => ({
  useMyCompanies: vi.fn(),
  useRefreshSharing: () => mocks.refresh,
}));

import { useMembershipAction } from '../useCompanyMembership';

describe('useMembershipAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue(undefined);
  });

  it('em caso de sucesso mostra o aviso e relê a lista', async () => {
    const { result } = renderHook(() => useMembershipAction());
    let out: unknown;
    await act(async () => {
      out = await result.current.run(async () => 'ok', 'Administrador adicionado');
    });
    expect(out).toBe('ok');
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Administrador adicionado' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('mostra o texto em português da base quando falha (nunca o código)', async () => {
    const { result } = renderHook(() => useMembershipAction());
    await act(async () => {
      await result.current.run(async () => {
        throw new SharingError('last_admin', 'Não pode retirar o último administrador da empresa.');
      }, 'feito');
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'Não pode retirar o último administrador da empresa.',
      variant: 'destructive',
    });
  });

  it('reauth_required abre o diálogo e, confirmada a palavra-passe, repete a chamada', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SharingError('reauth_required'))
      .mockResolvedValueOnce('feito');
    const { result } = renderHook(() => useMembershipAction());
    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = result.current.run(action, 'Acesso retirado');
    });
    await waitFor(() => expect(result.current.reauthOpen).toBe(true));
    await act(async () => {
      result.current.finishReauth(true);
      await promise;
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(await promise).toBe('feito');
    expect(result.current.reauthOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' });
  });

  it('se a pessoa desiste da palavra-passe não repete nem mostra erro', async () => {
    const action = vi.fn().mockRejectedValue(new SharingError('reauth_required'));
    const { result } = renderHook(() => useMembershipAction());
    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = result.current.run(action, 'x');
    });
    await waitFor(() => expect(result.current.reauthOpen).toBe(true));
    await act(async () => {
      result.current.finishReauth(false);
      await promise;
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(await promise).toBeUndefined();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('se depois de confirmar ainda pede reautenticação, a mensagem em português aparece', async () => {
    const action = vi.fn().mockRejectedValue(new SharingError('reauth_required'));
    const { result } = renderHook(() => useMembershipAction());
    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = result.current.run(action, 'x');
    });
    await waitFor(() => expect(result.current.reauthOpen).toBe(true));
    await act(async () => {
      result.current.finishReauth(true);
      await promise;
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'Confirme a sua palavra-passe para continuar.',
      variant: 'destructive',
    });
  });
});
