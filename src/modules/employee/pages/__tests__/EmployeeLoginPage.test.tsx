import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// A página lê `matchMedia` ao ser importada (modo PWA); o jsdom não o tem.
vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/modules/auth/services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock('@/modules/admin/services/accessService', () => ({
  accessService: { getUserRole: vi.fn() },
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useDeviceDetect', () => ({ useDeviceDetect: () => ({ isMobile: false }) }));
vi.mock('@/hooks/usePWAInstall', () => ({ usePWAInstall: () => ({ isInstalled: true }) }));

import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import EmployeeLoginPage from '../EmployeeLoginPage';

const session = { user: { id: 'user-1', email: 'colab@example.com' }, access_token: 't' };
const unavailable = {
  data: null,
  error: { code: 'PGRST002', message: 'Could not query the database for the schema cache.' },
};

const renderApp = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/colaborador/login" element={<EmployeeLoginPage />} />
          <Route
            path="/colaborador"
            element={
              <ProtectedRoute requiredRole="employee" fallbackPath="/colaborador/login">
                <div>Área do colaborador</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const lookups = () => vi.mocked(accessService.getUserRole).mock.calls.length;

// Queda de 21/10: o papel falhou com a BD em baixo e o AuthContext ficou "sem sessão", mas esta
// página lia `employees` por conta própria. Quando a BD voltou, ela dizia "é colaborador" e o
// ProtectedRoute "não está autenticado": mandavam uma para a outra (~400 pedidos/min).
describe('EmployeeLoginPage com a BD em baixo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    vi.mocked(authService.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('na área: mostra o aviso, não manda para o login e espera antes de tentar de novo', async () => {
    vi.mocked(accessService.getUserRole)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce({ data: 'employee', error: null });

    renderApp('/colaborador');
    await advance(0);

    expect(screen.getByText('Serviço indisponível, a tentar de novo…')).toBeInTheDocument();
    expect(screen.queryByText('Portal do Colaborador')).not.toBeInTheDocument();
    expect(lookups()).toBe(1);

    await advance(1_999);
    expect(lookups()).toBe(1);
    await advance(1); // 2 s
    expect(lookups()).toBe(2);
    await advance(4_000); // BD de volta
    expect(lookups()).toBe(3);

    expect(screen.getByText('Área do colaborador')).toBeInTheDocument();
    // A página de login nunca perguntou à BD por conta própria.
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('no login: fica no formulário com o aviso e entra sozinho quando a BD volta', async () => {
    vi.mocked(accessService.getUserRole)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce({ data: 'employee', error: null });

    renderApp('/colaborador/login');
    await advance(0);

    expect(screen.getByText('Portal do Colaborador')).toBeInTheDocument();
    expect(screen.getByText('Serviço indisponível, a tentar de novo…')).toBeInTheDocument();

    await advance(1_000);
    expect(lookups()).toBe(1);
    expect(supabase.from).not.toHaveBeenCalled();

    await advance(1_000);
    expect(lookups()).toBe(2);
    expect(screen.getByText('Área do colaborador')).toBeInTheDocument();
  });

  it('sessão sem papel de colaborador não salta entre o login e a área', async () => {
    vi.mocked(accessService.getUserRole).mockResolvedValue({ data: 'company_admin', error: null });

    renderApp('/colaborador');
    await advance(0);
    await advance(60_000);

    expect(screen.getByText('Portal do Colaborador')).toBeInTheDocument();
    expect(lookups()).toBe(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
