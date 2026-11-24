import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegalPage from '../LegalPage';

const client = (id: string, name: string, company_id: string) => ({
  id,
  name,
  nif: '',
  company_id,
  status: 'Em curso',
  litigation_value: 0,
  legal_installments: [],
});
const CLIENTS = [
  client('l1', 'Cliente da Alfa', 'c1'),
  client('l2', 'Cliente da Beta', 'c2'),
  client('l3', 'Cliente da Gama', 'c3'),
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        neq: () => builder,
        order: () => Promise.resolve({ data: CLIENTS, error: null }),
      };
      return builder;
    },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ canView: () => true, isLoading: false }),
}));

const agenda = vi.hoisted(() => ({ clients: [] as { id: string }[] }));
vi.mock('@/components/admin/legal/LegalAgenda', () => ({
  default: (props: { clients: { id: string }[] }) => {
    agenda.clients = props.clients;
    return null;
  },
}));
vi.mock('@/components/admin/legal/LegalClientModal', () => ({ default: () => null }));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <LegalPage />
    </MemoryRouter>
  );

describe('LegalPage: Jurídico segue o seletor de empresa', () => {
  beforeEach(() => {
    agenda.clients = [];
    scope.ids = null;
  });

  it('"Todas as empresas": todos os clientes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Cliente da Alfa')).toBeInTheDocument());
    expect(screen.getByText('Cliente da Beta')).toBeInTheDocument();
    expect(screen.getByText('Cliente da Gama')).toBeInTheDocument();
  });

  it('com um grupo escolhido, só os clientes das empresas do grupo (lista e agenda)', async () => {
    scope.ids = new Set(['c1', 'c3']);
    renderPage();
    await waitFor(() => expect(screen.getByText('Cliente da Alfa')).toBeInTheDocument());
    expect(screen.getByText('Cliente da Gama')).toBeInTheDocument();
    expect(screen.queryByText('Cliente da Beta')).not.toBeInTheDocument();
    expect(agenda.clients.map(c => c.id).sort()).toEqual(['l1', 'l3']);
  });

  it('com uma empresa sem clientes a lista fica vazia', async () => {
    scope.ids = new Set(['c9']);
    renderPage();
    await waitFor(() => expect(agenda.clients).toEqual([]));
    expect(screen.queryByText('Cliente da Alfa')).not.toBeInTheDocument();
  });
});
