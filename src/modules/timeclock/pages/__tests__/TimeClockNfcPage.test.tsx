import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { deriveWorkday } from '@/lib/workday';
import { useWorkday } from '../../context/useWorkday';
import TimeClockNfcPage from '../TimeClockNfcPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/useWorkday', () => ({ useWorkday: vi.fn() }));

const run = vi.fn().mockResolvedValue(null);
const warmUp = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

const LoginProbe = () => {
  const state = useLocation().state as { from?: { pathname: string; search: string } } | null;
  return <p>login → {`${state?.from?.pathname}${state?.from?.search}`}</p>;
};

const renderAt = (role: string) => {
  vi.mocked(useAuth).mockReturnValue({
    role,
    user: { email: 'admin@realize.pt' },
    logout,
  } as unknown as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={['/ponto/nfc?t=abc123']}>
      <Routes>
        <Route path="/ponto/nfc" element={<TimeClockNfcPage />} />
        <Route path="/" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TimeClockNfcPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkday).mockReturnValue({
      employee: { id: 'emp-1', name: 'Ana', company_id: 'c-1', companies: null },
      isLoading: false,
      entries: [],
      workday: deriveWorkday([]),
      phase: 'idle',
      outcome: null,
      isBusy: false,
      run,
      warmUp,
      refetch: vi.fn(),
      version: 0,
    });
  });

  it('shows the workday buttons and registers with the tag only when the employee taps', async () => {
    renderAt('employee');
    expect(run).not.toHaveBeenCalled();
    expect(warmUp).toHaveBeenCalled(); // GPS começa logo, para o registo ser rápido
    expect(screen.getByText(/Tag lida/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar dia' }));

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('start', { note: '', method: 'nfc', tag: { t: 'abc123' } });
    });
  });

  it('does not send admins to the admin panel and keeps the tag for the employee login', async () => {
    renderAt('admin');
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByText(/esta sessão não é de colaborador/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Entrar como colaborador/ }));

    await waitFor(() => {
      expect(screen.getByText('login → /ponto/nfc?t=abc123')).toBeInTheDocument();
    });
    expect(logout).toHaveBeenCalled();
  });
});
