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
  const row = screen.getByText('Acme Lda').closest('tr')!;
  await user.click(row.querySelector('button')!);
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

  it('"Editar" navega para a página da empresa, sem abrir pop-up', async () => {
    const user = userEvent.setup();
    renderPage();
    await openRowMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /editar/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem permissão de gerir não há "Nova Empresa", "Editar", "Eliminar" nem toggle', async () => {
    canManage = false;
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole('button', { name: /nova empresa/i })).not.toBeInTheDocument();
    await openRowMenu(user);
    expect(screen.queryByRole('menuitem', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /eliminar/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ativa'));
    expect(toggleStatus).not.toHaveBeenCalled();
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

  it('com permissão de gerir, clicar no estado alterna Ativa/Desativada', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText('Ativa'));
    await waitFor(() => expect(toggleStatus).toHaveBeenCalledWith('c1', false));
  });

  it('administrador de empresa (não super admin) edita mas não cria, elimina nem ativa/desativa', async () => {
    isSuperAdmin = false;
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole('button', { name: /nova empresa/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ativa'));
    expect(toggleStatus).not.toHaveBeenCalled();
    await openRowMenu(user);
    expect(await screen.findByRole('menuitem', { name: /editar/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
