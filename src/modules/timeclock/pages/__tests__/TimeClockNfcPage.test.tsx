import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { usePunch } from '../../hooks/usePunch';
import TimeClockNfcPage from '../TimeClockNfcPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/usePunch', () => ({ usePunch: vi.fn() }));
vi.mock('../../hooks/useCurrentEmployee', () => ({
  useCurrentEmployee: () => ({ employee: { id: 'emp-1' }, isLoading: false }),
}));
vi.mock('../../hooks/useMyTimeClock', () => ({
  useMyTimeClock: () => ({ lastEntry: null, isLoading: false }),
}));
// O formulário tem testes próprios; aqui basta simular a submissão.
vi.mock('../../components/employee/PunchForm', () => ({
  PunchForm: ({ onSubmit }: { onSubmit: (c: { entryType: 'in'; note: string }) => void }) => (
    <button onClick={() => onSubmit({ entryType: 'in', note: 'Esqueci a saída do almoço' })}>
      Registar
    </button>
  ),
}));

const punch = vi.fn();
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
        <Route path="/colaborador/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TimeClockNfcPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePunch).mockReturnValue({
      phase: 'idle',
      outcome: null,
      isBusy: false,
      lastNote: '',
      punch,
      warmUp,
      requestRemote: vi.fn(),
      swap: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('asks for Entrada/Saída and only registers after the employee submits', () => {
    renderAt('employee');
    expect(punch).not.toHaveBeenCalled();
    expect(warmUp).toHaveBeenCalled(); // GPS começa logo, para o registo ser rápido

    fireEvent.click(screen.getByRole('button', { name: 'Registar' }));

    expect(punch).toHaveBeenCalledWith(
      'nfc',
      { entryType: 'in', note: 'Esqueci a saída do almoço' },
      { t: 'abc123' }
    );
  });

  it('does not send admins to the admin panel and keeps the tag for the employee login', async () => {
    renderAt('admin');
    expect(punch).not.toHaveBeenCalled();
    expect(screen.getByText(/esta sessão não é de colaborador/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Entrar como colaborador/ }));

    await waitFor(() => {
      expect(screen.getByText('login → /ponto/nfc?t=abc123')).toBeInTheDocument();
    });
    expect(logout).toHaveBeenCalled();
  });
});
