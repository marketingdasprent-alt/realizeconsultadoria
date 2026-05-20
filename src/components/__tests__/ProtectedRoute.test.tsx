import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock do AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

describe('ProtectedRoute', () => {
  const mockUseAuth = vi.mocked(useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when checking authentication', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      role: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'admin',
      user: { id: 'user-123', email: 'admin@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      role: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // ProtectedRoute will redirect, so we shouldn't see the dashboard
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should redirect when role does not match required role', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'employee',
      user: { id: 'user-123', email: 'employee@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/colaborador" element={<div>Employee Area</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Role 'employee' sem permissão 'admin' → redireciona para /colaborador
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Employee Area')).toBeInTheDocument();
  });

  it('should not render protected content when role does not match', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'employee',
      user: { id: 'user-123', email: 'employee@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should allow access when user has required role', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'admin',
      user: { id: 'user-123', email: 'admin@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('should allow access with multiple required roles', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'company_admin',
      user: { id: 'user-123', email: 'company@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole={['admin', 'company_admin']}>
          <div>Multi-role Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Multi-role Content')).toBeInTheDocument();
  });

  it('should deny access with multiple required roles if user role not included', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: 'employee',
      user: { id: 'user-123', email: 'employee@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole={['admin', 'company_admin']}>
          <div>Multi-role Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Multi-role Content')).not.toBeInTheDocument();
  });

  it('should use custom fallback path', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      role: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute fallbackPath="/custom-login">
                <div>Protected</div>
              </ProtectedRoute>
            }
          />
          <Route path="/custom-login" element={<div>Custom Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to custom fallback path
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('should handle null role gracefully', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      role: null,
      user: { id: 'user-123', email: 'user@example.com' } as any,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
