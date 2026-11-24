import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MailClientsPage from '../MailClientsPage';

const client = (userId: string, name: string, companyId: string | null) => ({
  userId,
  mailbox: `${userId}@x.pt`,
  name,
  createdAt: '2026-11-01T10:00:00Z',
  lastLoginAt: null,
  disabledAt: null,
  companyId,
  companyName: companyId,
  companyFromTicket: false,
  accounts: [],
  ticketsOpen: 0,
  ticketsTotal: 0,
});
const CLIENTS = [
  client('u1', 'Cliente Alfa', 'c1'),
  client('u2', 'Cliente Beta', 'c2'),
  client('u3', 'Cliente Sem Empresa', null),
];

vi.mock('../../services/mailClientsService', () => ({
  mailClientsService: {
    list: () => Promise.resolve({ data: CLIENTS, error: null }),
    companies: () => Promise.resolve([]),
    setCompany: vi.fn(),
    setDisabled: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('../../components/mailClients/MailClientRow', () => ({
  MailClientRow: ({ client: c }: { client: { name: string } }) => <div>{c.name}</div>,
}));
vi.mock('../../components/mailClients/MailClientSignaturesDialog', () => ({
  MailClientSignaturesDialog: () => null,
}));
vi.mock('../../components/mailClients/MailPostosPanel', () => ({ MailPostosPanel: () => null }));
vi.mock('@/modules/workspace/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <MailClientsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('MailClientsPage: Realize Mail segue o seletor de empresa', () => {
  beforeEach(() => {
    scope.ids = null;
  });

  it('"Todas as empresas": todos os clientes, também os sem empresa', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Cliente Alfa')).toBeInTheDocument());
    expect(screen.getByText('Cliente Beta')).toBeInTheDocument();
    expect(screen.getByText('Cliente Sem Empresa')).toBeInTheDocument();
  });

  it('com uma empresa escolhida, só os clientes dela', async () => {
    scope.ids = new Set(['c2']);
    renderPage();
    await waitFor(() => expect(screen.getByText('Cliente Beta')).toBeInTheDocument());
    expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente Sem Empresa')).not.toBeInTheDocument();
  });
});
