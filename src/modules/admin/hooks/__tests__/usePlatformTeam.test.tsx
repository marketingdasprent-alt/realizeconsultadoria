import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../lib/sharing';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  refresh: vi.fn(),
  list: vi.fn(),
  candidates: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../useSharing', () => ({
  useRefreshSharing: () => mocks.refresh,
}));
vi.mock('../../services/superAdminService', () => ({
  superAdminService: { list: mocks.list, candidates: mocks.candidates },
}));

import {
  SUPER_ADMINS_KEY,
  useSuperAdminAction,
  useSuperAdminCandidates,
  useSuperAdmins,
} from '../usePlatformTeam';

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
};

describe('useSuperAdmins', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lê a lista quando está ativo e guarda-a sob a chave da equipa', async () => {
    mocks.list.mockResolvedValue([{ user_id: 'u1' }]);
    const { client, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSuperAdmins(true), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ user_id: 'u1' }]);
    expect(client.getQueryData([...SUPER_ADMINS_KEY, 'list'])).toEqual([{ user_id: 'u1' }]);
  });

  it('não chama a base quando está desativado', () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useSuperAdmins(false), { wrapper: Wrapper });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('não repete a chamada quando falha (a falta de permissão não passa com a repetição)', async () => {
    mocks.list.mockRejectedValue(new SharingError('not_platform_admin'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSuperAdmins(true), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});

describe('useSuperAdminCandidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('só lê os candidatos quando está ativo (diálogo aberto)', async () => {
    mocks.candidates.mockResolvedValue([{ user_id: 'u2' }]);
    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ on }) => useSuperAdminCandidates(on), {
      wrapper: Wrapper,
      initialProps: { on: false },
    });
    expect(mocks.candidates).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(result.current.data).toEqual([{ user_id: 'u2' }]));
    expect(mocks.candidates).toHaveBeenCalledTimes(1);
  });
});

describe('useSuperAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue(undefined);
  });

  const setup = () => renderHook(() => useSuperAdminAction());

  it('em caso de sucesso dá o aviso, relê a lista e a partilha, e devolve true', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(action, 'Acesso retirado', refetch);
    });
    expect(ok).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.codeOpen).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('mfa_required abre o diálogo e, com o código confirmado, repete UMA vez e dá o aviso', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SharingError('mfa_required'))
      .mockResolvedValueOnce(undefined);
    const refetch = vi.fn();
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      promise = result.current.run(action, 'Super administrador adicionado', refetch);
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    expect(action).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();

    await act(async () => {
      result.current.finishCode(true);
      await promise;
    });

    expect(await promise).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.codeOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Super administrador adicionado' });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reauth_required (confirmação antiga) também pede o código', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SharingError('reauth_required'))
      .mockResolvedValueOnce(undefined);
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      promise = result.current.run(action, 'feito', vi.fn());
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    await act(async () => {
      result.current.finishCode(true);
      await promise;
    });
    expect(await promise).toBe(true);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('desistir do código devolve false, não repete e não mostra aviso nenhum', async () => {
    const action = vi.fn().mockRejectedValue(new SharingError('mfa_required'));
    const refetch = vi.fn();
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      promise = result.current.run(action, 'feito', refetch);
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    await act(async () => {
      result.current.finishCode(false);
      await promise;
    });
    expect(await promise).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(result.current.codeOpen).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('se a repetição também falha dá toast destructive e NÃO pede o código outra vez', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SharingError('mfa_required'))
      .mockRejectedValueOnce(new SharingError('last_super_admin'));
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      promise = result.current.run(action, 'feito', vi.fn());
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    await act(async () => {
      result.current.finishCode(true);
      await promise;
    });
    expect(await promise).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.codeOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'A plataforma tem de ter pelo menos um super administrador.',
      variant: 'destructive',
    });
  });

  it('outros erros dão toast destructive com o texto em português, sem abrir o diálogo', async () => {
    const action = vi.fn().mockRejectedValue(new SharingError('already_super_admin'));
    const refetch = vi.fn();
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(action, 'feito', refetch);
    });
    expect(ok).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.codeOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'Esta pessoa já é super administradora.',
      variant: 'destructive',
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it('um erro que não é da base dá a mensagem genérica (nunca o texto técnico)', async () => {
    const action = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const { result } = setup();
    await act(async () => {
      await result.current.run(action, 'feito', vi.fn());
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'Não foi possível concluir. Tente outra vez.',
      variant: 'destructive',
    });
  });

  it('se depois do código a base ainda acha a sessão antiga avisa para sair e entrar, sem pedir outro código', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new SharingError('mfa_required'))
      .mockRejectedValueOnce(new SharingError('reauth_required'));
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      promise = result.current.run(action, 'feito', vi.fn());
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    await act(async () => {
      result.current.finishCode(true);
      await promise;
    });
    expect(await promise).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.codeOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Não foi possível concluir',
      description: 'A sua sessão está demasiado antiga. Saia e entre outra vez.',
      variant: 'destructive',
    });
  });

  it('se só a atualização das listas falha, a ação já feita continua a contar como sucesso', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const refetch = vi.fn().mockRejectedValue(new Error('rede'));
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(action, 'Acesso retirado', refetch);
    });
    expect(ok).toBe(true);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' });
  });

  it('se o ecrã sai com o diálogo do código aberto, a ação pendente termina em false e não repete', async () => {
    const action = vi.fn().mockRejectedValue(new SharingError('mfa_required'));
    const { result, unmount } = setup();
    let promise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      promise = result.current.run(action, 'feito', vi.fn());
    });
    await waitFor(() => expect(result.current.codeOpen).toBe(true));
    unmount();
    await expect(promise).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('pending fica true enquanto a ação corre e volta a false no fim', async () => {
    let finish: () => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const { result } = setup();
    let promise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      promise = result.current.run(action, 'feito', vi.fn());
    });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => {
      finish();
      await promise;
    });
    expect(result.current.pending).toBe(false);
  });

  it('finishCode sem nenhum pedido pendente não faz nada de mal', () => {
    const { result } = setup();
    expect(() => act(() => result.current.finishCode(true))).not.toThrow();
    expect(result.current.codeOpen).toBe(false);
  });
});
