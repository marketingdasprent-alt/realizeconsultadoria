import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

// Mock dos serviços
vi.mock('@/modules/auth/services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('@/modules/admin/services/accessService', () => ({
  accessService: {
    getUserRole: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';

// Componente de teste que usa o hook
const TestComponent = () => {
  const { user, role, isLoading, isAuthenticated, error } = useAuth();

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div>
      <div data-testid="user">{user ? `${user.email} (${role})` : 'Não autenticado'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Autenticado' : 'Não autenticado'}</div>
      {error && <div data-testid="error">{error}</div>}
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide AuthProvider wrapper', () => {
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: null,
      error: null,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('should initialize with no user', async () => {
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: null,
      error: null,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Não autenticado');
      expect(screen.getByTestId('authenticated').textContent).toBe('Não autenticado');
    });
  });

  it.skip('should load authenticated user on mount', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'admin@example.com' },
      access_token: 'token-123',
    };

    vi.mocked(authService.getSession).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as any);

    vi.mocked(accessService.getUserRole).mockResolvedValueOnce({
      data: 'admin',
      error: null,
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('user').textContent).toBe('admin@example.com (admin)');
        expect(screen.getByTestId('authenticated').textContent).toBe('Autenticado');
      },
      { timeout: 3000 }
    );
  });

  it.skip('should support login', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'admin@example.com' },
      access_token: 'token-123',
    };

    vi.mocked(authService.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    vi.mocked(authService.login).mockResolvedValueOnce({
      data: mockSession,
      error: null,
    } as any);

    vi.mocked(accessService.getUserRole).mockResolvedValueOnce({
      data: 'admin',
      error: null,
    } as any);

    const LoginComponent = () => {
      const { login, isLoading } = useAuth();

      return (
        <button
          onClick={async () => await login('admin@example.com', 'password')}
          disabled={isLoading}
        >
          Login
        </button>
      );
    };

    render(
      <AuthProvider>
        <LoginComponent />
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');

    await act(async () => {
      loginButton.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(authService.login).toHaveBeenCalledWith('admin@example.com', 'password');
      },
      { timeout: 3000 }
    );
  });

  it('should handle login error', async () => {
    const mockError = new Error('Invalid credentials');

    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(authService.login).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const LoginComponent = () => {
      const { login, error } = useAuth();

      return (
        <div>
          <button onClick={() => login('admin@example.com', 'wrong').catch(() => {})}>Login</button>
          {error && <div data-testid="login-error">{error}</div>}
        </div>
      );
    };

    render(
      <AuthProvider>
        <LoginComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');

    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalled();
    });
  });

  it('should support logout', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'admin@example.com' },
      access_token: 'token-123',
    };

    vi.mocked(authService.getSession)
      .mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

    vi.mocked(authService.logout).mockResolvedValue({
      success: true,
      error: null,
    });

    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: 'admin',
      error: null,
    } as any);

    const LogoutComponent = () => {
      const { logout } = useAuth();

      return <button onClick={() => logout()}>Logout</button>;
    };

    render(
      <AuthProvider>
        <LogoutComponent />
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('admin@example.com (admin)')).toBeInTheDocument();
    });

    const logoutButton = screen.getByText('Logout');

    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalled();
    });
  });

  it('should fetch user role on login', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'employee@example.com' },
      access_token: 'token-123',
    };

    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(authService.login).mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null,
    } as any);

    vi.mocked(accessService.getUserRole).mockResolvedValue({
      data: 'employee',
      error: null,
    } as any);

    const LoginComponent = () => {
      const { login } = useAuth();

      return <button onClick={() => login('employee@example.com', 'password')}>Login</button>;
    };

    render(
      <AuthProvider>
        <LoginComponent />
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');

    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(accessService.getUserRole).toHaveBeenCalledWith('user-123');
    });
  });

  it('should have checkAuth method', async () => {
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let authContext: ReturnType<typeof useAuth> | null = null;

    const TestAuthComponent = () => {
      authContext = useAuth();
      return null;
    };

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(typeof authContext?.checkAuth).toBe('function');
    });
  });

  it('should have clearError method', async () => {
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let authContext: ReturnType<typeof useAuth> | null = null;

    const TestAuthComponent = () => {
      authContext = useAuth();
      return null;
    };

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(typeof authContext?.clearError).toBe('function');
    });
  });

  it('should handle session retrieval errors', async () => {
    const mockError = new Error('Session error');

    vi.mocked(authService.getSession).mockRejectedValue(mockError);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('should provide correct interface', async () => {
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let authContext: ReturnType<typeof useAuth> | null = null;

    const TestAuthComponent = () => {
      authContext = useAuth();
      return null;
    };

    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authContext).toHaveProperty('user');
      expect(authContext).toHaveProperty('role');
      expect(authContext).toHaveProperty('isLoading');
      expect(authContext).toHaveProperty('isAuthenticated');
      expect(authContext).toHaveProperty('login');
      expect(authContext).toHaveProperty('logout');
      expect(authContext).toHaveProperty('checkAuth');
      expect(authContext).toHaveProperty('error');
      expect(authContext).toHaveProperty('clearError');
      expect(authContext).toHaveProperty('isServiceUnavailable');
    });
  });
});

// Queda de 21/10: depois de reiniciar a BD, o PostgREST deu 503 (PGRST002) durante minutos e
// os browsers abertos repetiam o pedido do papel sem pausa. Agora espera 2 s → 30 s.
describe('AuthContext — BD indisponível', () => {
  type AuthCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];

  const session = { user: { id: 'user-503', email: 'colab@example.com' }, access_token: 't' };
  const unavailable = {
    data: null,
    error: { code: 'PGRST002', message: 'Could not query the database for the schema cache.' },
  };
  let emitAuthEvent: AuthCallback | undefined;

  const Probe = () => {
    const { user, role, isServiceUnavailable, error } = useAuth();
    return (
      <div>
        <div data-testid="user">{user ? `${user.email} (${role})` : 'Não autenticado'}</div>
        <div data-testid="unavailable">{isServiceUnavailable ? 'sim' : 'não'}</div>
        {error && <div data-testid="error">{error}</div>}
      </div>
    );
  };

  const renderProvider = () =>
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const lookups = () => vi.mocked(accessService.getUserRole).mock.calls.length;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(callback => {
      emitAuthEvent = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    emitAuthEvent = undefined;
  });

  it('um 503 não gera pedidos seguidos: espera 2 s, 4 s, 8 s, 16 s e depois 30 s', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue(unavailable);

    renderProvider();
    await advance(0);

    expect(lookups()).toBe(1);
    expect(screen.getByTestId('unavailable').textContent).toBe('sim');
    expect(screen.getByTestId('user').textContent).toBe('Não autenticado');
    expect(screen.queryByTestId('error')).toBeNull(); // não diz "conta não habilitada"

    const waits = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000];
    for (const [index, wait] of waits.entries()) {
      await advance(wait - 1);
      expect(lookups()).toBe(index + 1); // nada antes de acabar a espera
      await advance(1);
      expect(lookups()).toBe(index + 2);
    }

    // 90 s de BD em baixo = 7 pedidos (antes eram centenas por minuto).
    expect(lookups()).toBe(7);
  });

  it('quando a BD volta, lê o papel, guarda-o e tira o aviso', async () => {
    vi.mocked(accessService.getUserRole)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce({ data: 'employee', error: null });

    renderProvider();
    await advance(0);
    expect(screen.getByTestId('unavailable').textContent).toBe('sim');

    await advance(2_000);

    expect(screen.getByTestId('user').textContent).toBe('colab@example.com (employee)');
    expect(screen.getByTestId('unavailable').textContent).toBe('não');
    expect(localStorage.getItem('rz.role.user-503')).toBe('employee');

    await advance(60_000);
    expect(lookups()).toBe(2); // e não volta a pedir
  });

  it('com o papel guardado no aparelho, continua dentro da app e não o apaga', async () => {
    localStorage.setItem('rz.role.user-503', 'employee');
    vi.mocked(accessService.getUserRole).mockResolvedValue(unavailable);

    renderProvider();
    await advance(0);

    expect(screen.getByTestId('user').textContent).toBe('colab@example.com (employee)');
    expect(screen.getByTestId('unavailable').textContent).toBe('sim');
    expect(localStorage.getItem('rz.role.user-503')).toBe('employee');

    await advance(2_000);
    expect(lookups()).toBe(2);
    expect(screen.getByTestId('user').textContent).toBe('colab@example.com (employee)');
  });

  it('eventos do Supabase durante a espera não antecipam a tentativa', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue(unavailable);

    renderProvider();
    await advance(0);
    expect(lookups()).toBe(1);

    await act(async () => {
      // O Supabase emite SIGNED_IN ao regressar à app e TOKEN_REFRESHED ao renovar o token.
      emitAuthEvent?.('SIGNED_IN', session as never);
      emitAuthEvent?.('TOKEN_REFRESHED', session as never);
      emitAuthEvent?.('SIGNED_IN', session as never);
    });
    await advance(0);
    expect(lookups()).toBe(1);

    await advance(2_000);
    expect(lookups()).toBe(2);
  });

  it('a sair da conta cancela a tentativa marcada', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue(unavailable);

    renderProvider();
    await advance(0);

    await act(async () => {
      emitAuthEvent?.('SIGNED_OUT', null);
    });
    await advance(60_000);

    expect(lookups()).toBe(1);
    expect(screen.getByTestId('unavailable').textContent).toBe('não');
  });

  it('conta sem papel continua a ser "sem papel", sem novas tentativas', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue({ data: null, error: null });

    renderProvider();
    await advance(0);

    expect(screen.getByTestId('error').textContent).toMatch(/não está habilitada/);
    expect(screen.getByTestId('unavailable').textContent).toBe('não');

    await advance(60_000);
    expect(lookups()).toBe(1);
  });
});
