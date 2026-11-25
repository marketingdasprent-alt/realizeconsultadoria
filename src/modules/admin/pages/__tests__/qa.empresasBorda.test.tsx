// QA (Capitã Marvel): casos de borda do PR #80, de ponta a ponta no router com os componentes reais
// (LegacySharingRedirect → CompanyFormPage → CompanySharing, e CompaniesPage). Só se simulam os
// dados (serviços/hooks) e os painéis pesados.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompaniesPage from '../CompaniesPage';
import CompanyFormPage from '../CompanyFormPage';
import LegacySharingRedirect from '../LegacySharingRedirect';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const COMPANY = (id: string, name: string) => ({
  id,
  name,
  nif: id.padEnd(9, '0'),
  email: `${id}@x.pt`,
  phone: '',
  address: '',
  city: 'Lisboa',
  postal_code: '',
  notes: '',
  is_active: true,
});

const state = vi.hoisted(() => ({
  isSuperAdmin: false,
  canViewSharing: true,
  mine: [] as { company_id: string; name: string; role: string; status: string }[],
  visibleCompanies: [] as unknown[],
}));

vi.mock('@/modules/admin/services/companyService', () => ({
  companyService: {
    getById: async (id: string) => ({
      data: {
        id,
        name: id === 'c1' ? 'Alfa' : 'Beta',
        nif: '123456789',
        email: 'a@x.pt',
        phone: '',
        address: '',
        city: 'Lisboa',
        postal_code: '',
        notes: '',
        is_active: true,
      },
      error: null,
    }),
    update: vi.fn(),
    createWithAdmin: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    isLoading: false,
    isSuperAdmin: state.isSuperAdmin,
    canExecuteTopic: () => true,
    canView: (module: string) => (module === 'sharing' ? state.canViewSharing : true),
  }),
}));
vi.mock('../../hooks/useSharing', () => ({
  useAllGroups: () => ({ data: [] }),
  useMyCompanies: () => ({ data: state.mine, isLoading: false, error: null }),
}));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => ({ ids: null }) }));
vi.mock('@/hooks/useCompanies', () => ({
  useCompanies: () => ({
    companies: state.visibleCompanies,
    isLoading: false,
    updateCompany: vi.fn(),
    deleteCompany: vi.fn(),
    toggleStatus: vi.fn(),
  }),
}));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));
vi.mock('../../hooks/useCompanyListFacts', () => ({ useCompanyListFacts: () => new Map() }));
vi.mock('../../components/sharing/AllGroupsPanel', () => ({
  AllGroupsPanel: () => <div data-testid="all-groups">Painel de todos os grupos</div>,
}));
vi.mock('../../components/CompanyAdminsSection', () => ({
  CompanyAdminsSection: () => <div>admins</div>,
}));
vi.mock('../../components/CompanyEmployeesSection', () => ({
  CompanyEmployeesSection: () => <div>colaboradores</div>,
}));
vi.mock('../../components/sharing/ShareCodeCard', () => ({
  ShareCodeCard: () => <div data-testid="painel-codigo">painel codigo</div>,
}));
vi.mock('../../components/sharing/RequestsPanel', () => ({
  RequestsPanel: () => <div data-testid="painel-pedidos">painel pedidos</div>,
}));
vi.mock('../../components/sharing/SharesPanel', () => ({
  SharesPanel: () => <div data-testid="painel-acesso">painel acesso</div>,
}));
vi.mock('../../components/sharing/GroupPanel', () => ({
  GroupPanel: () => <div data-testid="painel-grupo">painel grupo</div>,
}));
vi.mock('../../components/sharing/ViewersPanel', () => ({
  ViewersPanel: () => <div data-testid="painel-quem-ve">painel quem-ve</div>,
}));
vi.mock('../../components/sharing/RequestShareDialog', () => ({
  RequestShareDialog: () => <button type="button">Pedir partilha</button>,
}));

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderAt = (url: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/admin/partilha" element={<LegacySharingRedirect />} />
          <Route path="/admin/empresas" element={<CompaniesPage />} />
          <Route path="/admin/empresas/:id" element={<CompanyFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const selectedTabs = () => screen.getAllByRole('tab', { selected: true }).map(t => t.textContent);
const nameInput = () => screen.getByLabelText(/nome/i, { selector: 'input' }) as HTMLInputElement;

beforeEach(() => {
  state.isSuperAdmin = false;
  state.canViewSharing = true;
  state.mine = [{ company_id: 'c1', name: 'Alfa', role: 'admin', status: 'ativo' }];
  state.visibleCompanies = [COMPANY('c1', 'Alfa')];
});

describe('QA PR #80: /admin/partilha → Empresas (de ponta a ponta)', () => {
  it('?tab=quem-ve cai em "Quem pode ver" da Partilha da empresa', async () => {
    renderAt('/admin/partilha?tab=quem-ve');
    expect(await screen.findByTestId('painel-quem-ve')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/admin/empresas/c1?tab=partilha&sub=quem-ve'
    );
    expect(selectedTabs()).toEqual(['Ligações com outras empresas', 'Quem pode ver']);
  });

  it('?tab=xpto (desconhecido) cai no Código, sem página vazia nem erro', async () => {
    renderAt('/admin/partilha?tab=xpto');
    expect(await screen.findByTestId('painel-codigo')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1?tab=partilha');
    expect(selectedTabs()).toEqual(['Ligações com outras empresas', 'Código']);
  });

  it('?tab=grupos como super admin abre a zona Grupos da lista', async () => {
    state.isSuperAdmin = true;
    state.mine = [];
    renderAt('/admin/partilha?tab=grupos');
    expect(await screen.findByTestId('all-groups')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas?tab=grupos');
  });

  it('?tab=grupos como admin de uma só empresa fica na lista, sem Grupos e sem painel', async () => {
    renderAt('/admin/partilha?tab=grupos');
    expect(await screen.findByText('Alfa')).toBeInTheDocument();
    expect(screen.queryByTestId('all-groups')).not.toBeInTheDocument();
    expect(screen.queryByText('Grupos')).not.toBeInTheDocument();
  });
});

describe('QA PR #80: ficha da empresa', () => {
  it('?tab=partilha&sub=xpto abre a Partilha no Código', async () => {
    renderAt('/admin/empresas/c1?tab=partilha&sub=xpto');
    expect(await screen.findByTestId('painel-codigo')).toBeInTheDocument();
    expect(selectedTabs()).toEqual(['Ligações com outras empresas', 'Código']);
  });

  it('Identidade continua montada: o que se escreveu sobrevive a ir a outro separador e voltar', async () => {
    const user = userEvent.setup();
    renderAt('/admin/empresas/c1');
    await screen.findByRole('tab', { name: 'Identidade' });
    const name = nameInput();
    await user.clear(name);
    await user.type(name, 'Alfa editada');
    await user.click(screen.getByRole('tab', { name: 'Equipa' }));
    expect(await screen.findByText('admins')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Ligações com outras empresas' }));
    expect(await screen.findByTestId('painel-codigo')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Identidade' }));
    expect(nameInput()).toBe(name); // o mesmo nó do DOM: nunca foi desmontado
    expect(nameInput().value).toBe('Alfa editada');
  });

  it('admin de c1 não vê a Partilha de c2 (?tab=partilha cai na Identidade, sem painéis)', async () => {
    renderAt('/admin/empresas/c2?tab=partilha');
    await screen.findByRole('tab', { name: 'Identidade' });
    expect(
      screen.queryByRole('tab', { name: 'Ligações com outras empresas' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('painel-codigo')).not.toBeInTheDocument();
    await waitFor(() => expect(nameInput()).toBeInTheDocument());
  });

  it('sem a permissão "sharing" não há Partilha nem pelo endereço', async () => {
    state.canViewSharing = false;
    renderAt('/admin/empresas/c1?tab=partilha&sub=quem-ve');
    await screen.findByRole('tab', { name: 'Identidade' });
    expect(
      screen.queryByRole('tab', { name: 'Ligações com outras empresas' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('painel-quem-ve')).not.toBeInTheDocument();
  });
});

describe('QA PR #80: lista de Empresas para admin de uma só empresa', () => {
  it('só vê a sua empresa, sem separador Grupos', async () => {
    renderAt('/admin/empresas');
    expect(await screen.findByText('Alfa')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('Grupos')).not.toBeInTheDocument();
  });
});
