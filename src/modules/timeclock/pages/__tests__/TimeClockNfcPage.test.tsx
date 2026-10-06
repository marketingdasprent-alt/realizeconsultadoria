import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { usePunch } from '../../hooks/usePunch';
import TimeClockNfcPage from '../TimeClockNfcPage';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/usePunch', () => ({ usePunch: vi.fn() }));

const punch = vi.fn();
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
      punch,
      requestRemote: vi.fn(),
      swap: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('registers the tag with an employee session', () => {
    renderAt('employee');
    expect(punch).toHaveBeenCalledWith('nfc', { t: 'abc123' });
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
