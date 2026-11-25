import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompaniesPage from '../CompaniesPage';

const COMPANIES = [
  {
    id: 'c1',
    name: 'Acme Lda',
    nif: '123456789',
    email: 'geral@acme.pt',
    phone: '',
    address: '',
    city: 'Lisboa',
    postal_code: '',
    notes: '',
    is_active: true,
  },
];

const deleteCompany = vi.fn();
const toggleStatus = vi.fn();
vi.mock('@/hooks/useCompanies', () => ({
  useCompanies: () => ({
    companies: COMPANIES,
    isLoading: false,
    updateCompany: vi.fn(),
    deleteCompany: (...args: unknown[]) => deleteCompany(...args),
    toggleStatus: (...args: unknown[]) => toggleStatus(...args),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../hooks/useCompanyListFacts', () => ({ useCompanyListFacts: () => new Map() }));
vi.mock('../../components/sharing/AllGroupsPanel', () => ({ AllGroupsPanel: () => null }));

let canManage = true;
let isSuperAdmin = true;
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ canExecuteTopic: () => canManage, isSuperAdmin }),
}));

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/empresas']}>
      <Where />
      <Routes>
        <Route path="/admin/empresas" element={<CompaniesPage />} />
        <Route path="/admin/empresas/nova" element={<div>Página nova</div>} />
        <Route path="/admin/empresas/:id" element={<div>Página de edição</div>} />
      </Routes>
    </MemoryRouter>
  );

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Mais ações de Acme Lda' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  canManage = true;
  isSuperAdmin = true;
  deleteCompany.mockResolvedValue({ success: true, error: null });
  toggleStatus.mockResolvedValue({ data: null, error: null });
});

describe('CompaniesPage', () => {
  it('"Nova Empresa" navega para a página de criação, sem abrir pop-up', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /nova empresa/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/nova');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicar em qualquer sítio da linha abre a ficha, sem pop-up', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText('123456789'));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicar no nome abre a ficha uma só vez (a ligação e a linha não navegam duas vezes)', async () => {
    const user = userEvent.setup();
    renderPage();
    const link = screen.getByRole('link', { name: 'Acme Lda' });
    expect(link).toHaveAttribute('href', '/admin/empresas/c1');
    await user.click(link);
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
    expect(screen.getByText('Página de edição')).toBeInTheDocument();
  });

  it('com o teclado: Tab chega ao nome, com foco visível, e Enter abre a ficha', async () => {
    const user = userEvent.setup();
    renderPage();
    const link = screen.getByRole('link', { name: 'Acme Lda' });
    expect(link.className).toMatch(/focus-visible:ring/);
    // Antes da lista há os separadores do super admin: Tab até chegar ao nome
    for (let i = 0; i < 8 && document.activeElement !== link; i += 1) await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
    expect(screen.getByText('Página de edição')).toBeInTheDocument();
  });

  it('os 3 pontos só abrem o menu: não abrem a ficha', async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user);
    expect(await screen.findByRole('menuitem', { name: /eliminar/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/empresas$/);
  });

  it('clicar no estado alterna e não abre a ficha', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /desativar Acme Lda/i }));
    await waitFor(() => expect(toggleStatus).toHaveBeenCalledWith('c1', false));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/empresas$/);
  });

  it('mostra as iniciais da empresa quando não tem logo', () => {
    renderPage();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('sem permissão de gerir não há "Nova Empresa", ligação, menu nem toggle, e a linha não abre', async () => {
    canManage = false;
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole('button', { name: /nova empresa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Acme Lda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mais ações/i })).not.toBeInTheDocument();
    await user.click(screen.getByText('123456789'));
    await user.click(screen.getByText('Ativa'));
    expect(toggleStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/empresas$/);
  });

  it('com permissão de gerir, "Eliminar" pede confirmação e só depois apaga', async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /eliminar/i }));
    expect(await screen.findByText('Eliminar Empresa')).toBeInTheDocument();
    expect(deleteCompany).not.toHaveBeenCalled();
    const buttons = screen
      .getAllByRole('button')
      .filter(b => /eliminar/i.test(b.textContent ?? ''));
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(deleteCompany).toHaveBeenCalledWith('c1'));
  });

  it('administrador de empresa (não super admin) abre a ficha, mas não cria, elimina nem ativa/desativa', async () => {
    isSuperAdmin = false;
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole('button', { name: /nova empresa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mais ações/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desativar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Empresas' })).not.toBeInTheDocument();
    await user.click(screen.getByText('Ativa'));
    expect(toggleStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
  });
});
