import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    companies: [company('c1', 'Alfa Lda'), company('c2', 'Beta Lda')],
    isLoading: false,
    updateCompany: vi.fn(),
    deleteCompany: vi.fn(),
    toggleStatus: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => ({ ids: null }) }));
vi.mock('../../components/sharing/AllGroupsPanel', () => ({
  AllGroupsPanel: () => <div>Painel de todos os grupos</div>,
}));

const perms = vi.hoisted(() => ({ isSuperAdmin: true }));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ canExecuteTopic: () => true, isSuperAdmin: perms.isSuperAdmin }),
}));

vi.mock('../../hooks/useCompanyListFacts', () => ({
  useCompanyListFacts: () =>
    new Map([
      ['c1', { group: 'Grupo Realize', admins: 2 }],
      ['c2', { group: null, admins: null }],
    ]),
}));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CompaniesPage />
    </MemoryRouter>
  );

describe('CompaniesPage: Grupos, grupo e administradores por empresa', () => {
  beforeEach(() => {
    perms.isSuperAdmin = true;
  });

  it('a lista mostra o grupo e o nº de administradores de cada empresa ("—" quando não se sabe)', () => {
    renderAt('/admin/empresas');
    const alfa = screen.getByText('Alfa Lda').closest('tr')!;
    expect(alfa).toHaveTextContent('Grupo Realize');
    expect(alfa).toHaveTextContent('2');
    const beta = screen.getByText('Beta Lda').closest('tr')!;
    expect(beta.textContent?.match(/—/g)).toHaveLength(2);
  });

  it('o super admin tem o separador Grupos e abre-o pelo endereço', async () => {
    renderAt('/admin/empresas?tab=grupos');
    expect(screen.getByText('Painel de todos os grupos')).toBeInTheDocument();
    expect(screen.queryByText('Alfa Lda')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Empresas' }));
    expect(screen.getByText('Alfa Lda')).toBeInTheDocument();
  });

  it('o super admin passa de Empresas para Grupos pelo separador', async () => {
    renderAt('/admin/empresas');
    expect(screen.queryByText('Painel de todos os grupos')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Grupos' }));
    expect(screen.getByText('Painel de todos os grupos')).toBeInTheDocument();
  });

  it('quem não é super admin não tem Grupos, nem com ?tab=grupos no endereço', () => {
    perms.isSuperAdmin = false;
    renderAt('/admin/empresas?tab=grupos');
    expect(screen.queryByRole('button', { name: 'Grupos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Painel de todos os grupos')).not.toBeInTheDocument();
    expect(screen.getByText('Alfa Lda')).toBeInTheDocument();
  });
});
