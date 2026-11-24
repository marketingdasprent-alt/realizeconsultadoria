import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupportTicketsPage from '../SupportTicketsPage';

const ticket = (id: string, company: string) => ({
  id,
  company_id: company,
  department_id: 'd1',
  status: 'open',
});
const TICKETS = [ticket('t1', 'c1'), ticket('t2', 'c2'), ticket('t3', 'c3')];

vi.mock('@/hooks/useSupportDepartments', () => ({
  useSupportDepartments: () => ({
    departments: [{ id: 'd1', name: 'Geral' }],
    isLoading: false,
    canAccessDepartment: () => true,
    isSuperAdmin: true,
    userDepartmentIds: [],
  }),
}));
vi.mock('@/hooks/useAdminTickets', () => ({
  useAdminTickets: () => ({
    tickets: TICKETS,
    isLoading: false,
    refetch: vi.fn(),
    updateTicketStatus: vi.fn(),
  }),
}));

const desk = vi.hoisted(() => ({ tickets: [] as { id: string }[] }));
vi.mock('../../components/support/SupportDesk', () => ({
  SupportDesk: (props: { tickets: { id: string }[] }) => {
    desk.tickets = props.tickets;
    return <div data-testid="fila" />;
  },
}));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <SupportTicketsPage />
    </MemoryRouter>
  );

describe('SupportTicketsPage: a fila de Suporte segue o seletor de empresa', () => {
  beforeEach(() => {
    desk.tickets = [];
    scope.ids = null;
  });

  it('"Todas as empresas": todos os tickets', () => {
    renderPage();
    expect(desk.tickets.map(t => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('com um grupo escolhido, só os tickets das empresas do grupo', () => {
    scope.ids = new Set(['c1', 'c3']);
    renderPage();
    expect(desk.tickets.map(t => t.id)).toEqual(['t1', 't3']);
  });

  it('com uma empresa sem tickets a fila fica vazia', () => {
    scope.ids = new Set(['c9']);
    renderPage();
    expect(desk.tickets).toEqual([]);
  });
});
