import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompaniesPage from '../CompaniesPage';

const company = (id: string, name: string) => ({
  id,
  name,
  nif: id.padEnd(9, '0'),
  email: `${id}@x.pt`,
  phone: '',
  address: '',
  city: '',
  postal_code: '',
  notes: '',
  is_active: true,
});

vi.mock('@/hooks/useCompanies', () => ({
  useCompanies: () => ({
    companies: [company('c1', 'Alfa Lda'), company('c2', 'Beta Lda'), company('c3', 'Gama Lda')],
    isLoading: false,
    updateCompany: vi.fn(),
    deleteCompany: vi.fn(),
    toggleStatus: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../hooks/useCompanyListFacts', () => ({ useCompanyListFacts: () => new Map() }));
vi.mock('../../components/sharing/AllGroupsPanel', () => ({ AllGroupsPanel: () => null }));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ canExecuteTopic: () => true, isSuperAdmin: true }),
}));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompaniesPage />
    </MemoryRouter>
  );

describe('CompaniesPage: lista de Empresas segue o seletor de empresa', () => {
  beforeEach(() => {
    scope.ids = null;
  });

  it('"Todas as empresas": mostra as três', () => {
    renderPage();
    for (const name of ['Alfa Lda', 'Beta Lda', 'Gama Lda']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('com um grupo escolhido, só as empresas do grupo', () => {
    scope.ids = new Set(['c1', 'c3']);
    renderPage();
    expect(screen.getByText('Alfa Lda')).toBeInTheDocument();
    expect(screen.getByText('Gama Lda')).toBeInTheDocument();
    expect(screen.queryByText('Beta Lda')).not.toBeInTheDocument();
  });

  it('com uma empresa escolhida, só essa', () => {
    scope.ids = new Set(['c2']);
    renderPage();
    expect(screen.getByText('Beta Lda')).toBeInTheDocument();
    expect(screen.queryByText('Alfa Lda')).not.toBeInTheDocument();
  });
});
