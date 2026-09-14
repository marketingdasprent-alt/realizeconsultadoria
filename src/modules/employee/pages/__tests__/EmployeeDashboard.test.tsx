import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import EmployeeDashboard from '../EmployeeDashboard';

vi.mock('@/integrations/supabase/client', () => {
  const employee = {
    id: 'employee-1',
    name: 'Thiago',
    email: 'thiago@example.com',
    company_id: 'company-1',
    companies: { name: 'Realize' },
  };
  const approvedVacation = {
    id: 'absence-1',
    employee_id: employee.id,
    company_id: employee.company_id,
    absence_type: 'vacation',
    status: 'approved',
    start_date: '2026-10-05',
    end_date: '2026-10-09',
    notes: null,
    absence_periods: [
      {
        id: 'period-1',
        absence_id: 'absence-1',
        start_date: '2026-10-05',
        end_date: '2026-10-09',
        business_days: 5,
        period_type: 'full_day',
        start_time: null,
        end_time: null,
        status: 'approved',
      },
    ],
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: employee.email } } },
        }),
        signOut: vi.fn(),
      },
      from: vi.fn((table: string) => {
        if (table === 'employees') {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: vi.fn().mockResolvedValue({ data: employee, error: null }),
          };
          return query;
        }
        if (table === 'absences') {
          const query = {
            select: () => query,
            eq: () => query,
            order: vi.fn().mockResolvedValue({ data: [approvedVacation], error: null }),
          };
          return query;
        }
        if (table === 'holidays') {
          const query = {
            select: () => query,
            gte: () => query,
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
          return query;
        }
        if (table === 'employee_vacation_balances') {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_days: 22, used_days: 5, self_schedulable_days: null },
              error: null,
            }),
          };
          return query;
        }
        if (table === 'absence_documents') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        const query = {
          select: () => query,
          eq: () => query,
          in: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        };
        return query;
      }),
    },
  };
});

vi.mock('@/components/employee/VacationBalanceCard', () => ({ default: () => null }));
vi.mock('@/components/employee/EmployeeCalendar', () => ({ default: () => null }));
vi.mock('@/components/employee/AvisosSection', () => ({ AvisosSection: () => null }));
vi.mock('@/components/PWAInstallBanner', () => ({ default: () => null }));

describe('EmployeeDashboard', () => {
  it('mostra a ação de remarcar num pedido de férias aprovado', async () => {
    // Given: o colaborador tem férias futuras aprovadas
    render(
      <MemoryRouter>
        <EmployeeDashboard />
      </MemoryRouter>
    );

    // When: o histórico de pedidos termina de carregar
    await screen.findAllByText(/05 out/);

    // Then: o próprio colaborador pode iniciar a remarcação
    expect(
      screen.getByRole('button', { name: 'Remarcar férias de 05/10/2026' })
    ).toBeInTheDocument();
  });
});
