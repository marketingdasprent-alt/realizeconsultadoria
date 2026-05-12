import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      role: null,
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
      role: null,
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
      role: 'admin',
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
      role: 'admin',
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
      role: 'admin',
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
      data: mockSession,
      error: null,
    } as any);

    vi.mocked(accessService.getUserRole).mockResolvedValue({
      role: 'employee',
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
    });
  });
});
