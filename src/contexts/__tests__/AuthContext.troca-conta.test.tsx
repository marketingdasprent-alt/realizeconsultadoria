import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

type Listener = (event: string, session: unknown) => void;
const auth = vi.hoisted(() => ({ listener: null as Listener | null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener: Listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
vi.mock('@/modules/auth/services/authService', () => ({
  authService: { login: vi.fn(), logout: vi.fn(), getSession: vi.fn() },
}));
vi.mock('@/modules/admin/services/accessService', () => ({
  accessService: { getUserRole: vi.fn() },
}));

import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';

const sessionOf = (id: string) => ({ user: { id, email: `${id}@exemplo.pt` }, access_token: 't' });

const Probe = () => {
  const { user, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.id ?? 'ninguém'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
    </div>
  );
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe('AuthContext: troca de conta no mesmo separador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: sessionOf('u1') },
      error: null,
    } as never);
  });
  afterEach(() => localStorage.clear());

  it('a conta anterior não fica à vista enquanto se lê o papel da nova', async () => {
    const roleOfU2 = deferred<{ data: string; error: null }>();
    vi.mocked(accessService.getUserRole).mockImplementation(((id: string) =>
      id === 'u1'
        ? Promise.resolve({ data: 'employee', error: null })
        : roleOfU2.promise) as never);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u1'));

    // Outro separador entrou com outra conta: o Supabase avisa este.
    act(() => auth.listener?.('SIGNED_IN', sessionOf('u2')));

    // Enquanto o papel da conta nova não chega, a conta u1 já não aparece.
    expect(screen.getByTestId('user').textContent).not.toBe('u1');
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await act(async () => roleOfU2.resolve({ data: 'employee', error: null }));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u2'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('a mesma conta a renovar a sessão não pisca nem volta a ler o papel', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: 'employee',
      error: null,
    } as never);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u1'));
    const lookups = vi.mocked(accessService.getUserRole).mock.calls.length;

    act(() => auth.listener?.('TOKEN_REFRESHED', sessionOf('u1')));
    expect(screen.getByTestId('user').textContent).toBe('u1');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(vi.mocked(accessService.getUserRole).mock.calls.length).toBe(lookups);
  });

  it('a conta nova com o papel já guardado entra logo, sem passar pela anterior', async () => {
    localStorage.setItem('rz.role.u2', 'employee');
    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: 'employee',
      error: null,
    } as never);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u1'));

    act(() => auth.listener?.('SIGNED_IN', sessionOf('u2')));
    expect(screen.getByTestId('user').textContent).toBe('u2');
  });
});
