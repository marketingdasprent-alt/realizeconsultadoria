import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from '@/modules/workspace/context/workspaceContext';
import type { AbsencesData } from '../../services/absenceRequestService';
import AbsencesPage from '../AbsencesPage';

const period = (id: string, start: string, end: string, status: string) => ({
  id,
  start_date: start,
  end_date: end,
  business_days: 5,
  period_type: 'full_day',
  start_time: null,
  end_time: null,
  status,
});

const DATA: AbsencesData = {
  balance: { total_days: 22, used_days: 5, self_schedulable_days: null },
  scheduledByEmployee: 0,
  pendingVacationDays: 5,
  holidays: [],
  absences: [
    {
      id: 'absence-1',
      absence_type: 'vacation',
      status: 'approved',
      start_date: '2026-03-02',
      end_date: '2026-10-09',
      notes: null,
      absence_periods: [
        period('p0', '2026-03-02', '2026-03-03', 'approved'),
        period('p1', '2026-10-05', '2026-10-09', 'approved'),
      ],
    },
    {
      id: 'absence-2',
      absence_type: 'vacation',
      status: 'pending',
      start_date: '2026-11-16',
      end_date: '2026-11-20',
      notes: null,
      absence_periods: [period('p2', '2026-11-16', '2026-11-20', 'pending')],
    },
  ],
};

vi.mock('../../services/absenceRequestService', () => ({
  absenceRequestService: { load: vi.fn(async () => ({ data: DATA, error: null })) },
}));
vi.mock('@/components/admin/AbsenceDocumentsDialog', () => ({ default: () => null }));
vi.mock('@/components/employee/AddDocumentsDialog', () => ({ default: () => null }));

const workspace: WorkspaceContextValue = {
  user: {
    userId: 'user-1',
    employeeId: 'employee-1',
    companyId: 'company-1',
    name: 'Thiago',
    email: 'thiago@example.com',
    position: null,
    department: null,
    companyName: 'Realize',
    phone: null,
    hireDate: null,
  },
  basePath: '/colaborador',
  isPreview: false,
  onLogout: vi.fn(),
  onChangePassword: vi.fn(),
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceContext.Provider value={workspace}>
        <MemoryRouter>
          <AbsencesPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  );

describe('AbsencesPage', () => {
  // Os pedidos de exemplo são de out/nov 2026: fixa o "hoje" para continuarem futuros.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T10:00:00'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('mostra o saldo disponível (22 − 5 usados)', async () => {
    renderPage();
    expect(await screen.findByText('dias disponíveis')).toBeInTheDocument();
    expect(screen.getByText(/^17/)).toBeInTheDocument();
  });

  it('lista períodos, não pedidos: remarca o período futuro de um pedido que já tem um passado', async () => {
    renderPage();
    // O pedido começou em março (passado), mas o período de outubro ainda se remarca.
    expect(await screen.findByRole('button', { name: 'Remarcar 5 – 9 out' })).toBeInTheDocument();
    // O de março fica no histórico (recolhido), sem ações.
    expect(screen.queryByRole('button', { name: /Remarcar 2 – 3 mar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Histórico/ })).toBeInTheDocument();
  });

  it('um período pendente edita-se', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Editar 16 – 20 nov' })).toBeInTheDocument();
  });
});
