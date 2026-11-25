// "Tentar de novo" do aviso da Partilha com o React Query a sério (o mock de CompanyFormPage.test
// não reproduz o que o React Query faz: sem dados, ao repetir apaga o erro e volta a "a carregar").
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyFormPage from '../CompanyFormPage';

const myCompanies = vi.fn();
vi.mock('../../services/sharingService', () => ({
  sharingService: { myCompanies: () => myCompanies(), listAllGroups: vi.fn() },
}));
vi.mock('@/modules/admin/services/companyService', () => ({
  companyService: {
    getById: async () => ({
      data: {
        id: 'c1',
        name: 'Acme Lda',
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
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    isLoading: false,
    isSuperAdmin: false,
    canExecuteTopic: () => true,
    canView: () => true,
  }),
}));
vi.mock('../../components/company/CompanySharing', () => ({
  CompanySharing: () => <div data-testid="sharing-section">Partilha</div>,
}));
// Os números do cabeçalho têm leituras próprias: aqui só conta a leitura das empresas da conta
vi.mock('../../hooks/useCompanyListFacts', () => ({ useCompanyListFacts: () => new Map() }));
vi.mock('../../hooks/useCompanyMembership', () => ({
  useCompanyEmployees: () => ({ data: undefined }),
}));
vi.mock('../../components/CompanyAdminsSection', () => ({ CompanyAdminsSection: () => null }));
vi.mock('../../components/CompanyEmployeesSection', () => ({
  CompanyEmployeesSection: () => null,
}));

const FAIL = { code: 'unavailable', message: 'sem rede' }; // 'unavailable' não é repetido pelo hook
const ADMIN = [{ company_id: 'c1', role: 'admin', name: 'Acme Lda', status: 'ativo' }];
const NOT_ADMIN = [{ company_id: 'c1', role: 'colaborador', name: 'Acme Lda', status: 'ativo' }];

let client: QueryClient;
const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/empresas/c1?tab=partilha']}>
        <Routes>
          <Route path="/admin/empresas/:id" element={<CompanyFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const alertText = () => screen.findByRole('alert');
const retryButton = () => screen.getByRole('button', { name: /tentar/i });

beforeEach(() => {
  myCompanies.mockReset();
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
});
afterEach(() => onlineManager.setOnline(true));

describe('Partilha: erro a ler as empresas da conta', () => {
  it('um novo pedido que não veio do botão (ex.: a rede voltou) não troca o aviso pelo spinner', async () => {
    myCompanies.mockRejectedValueOnce(FAIL);
    renderPage();
    expect(await alertText()).toHaveTextContent(/não foi possível carregar as ligações/i);
    // Outro consumidor da mesma query (ou o regresso da rede) refaz o pedido
    let release: (value: unknown) => void = () => {};
    myCompanies.mockReturnValueOnce(new Promise(resolve => (release = resolve)));
    await act(async () => {
      void client.refetchQueries({ queryKey: ['admin', 'sharing', 'companies'] });
    });
    // O pedido novo está mesmo a correr e a árvore já foi renderizada com esse estado
    await waitFor(() => expect(client.isFetching()).toBe(1));
    await act(async () => {});
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await act(async () => release(ADMIN));
    expect(await screen.findByTestId('sharing-section')).toBeInTheDocument();
  });

  it('repetir e falhar outra vez: o botão volta a estar disponível', async () => {
    myCompanies.mockRejectedValueOnce(FAIL);
    renderPage();
    await alertText();
    let fail: (reason: unknown) => void = () => {};
    myCompanies.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    await userEvent.click(retryButton());
    // Durante o pedido: "A tentar…" e bloqueado; depois da falha volta a estar disponível
    expect(await screen.findByRole('button', { name: /a tentar/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await act(async () => fail(FAIL));
    await waitFor(() => expect(retryButton()).toHaveTextContent('Tentar de novo'));
    expect(retryButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('repetir com sucesso como administrador abre a Partilha', async () => {
    myCompanies.mockRejectedValueOnce(FAIL).mockResolvedValue(ADMIN);
    renderPage();
    await alertText();
    await userEvent.click(retryButton());
    expect(await screen.findByTestId('sharing-section')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('repetir com sucesso sem ser administrador mostra "sem acesso", não o erro', async () => {
    myCompanies.mockRejectedValueOnce(FAIL).mockResolvedValue(NOT_ADMIN);
    renderPage();
    await alertText();
    await userEvent.click(retryButton());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/não tem acesso às ligações/i)
    );
    expect(screen.queryByRole('button', { name: /tentar/i })).not.toBeInTheDocument();
  });

  it('sem rede o pedido fica em pausa e o botão não fica preso em "A tentar…"', async () => {
    myCompanies.mockRejectedValueOnce(FAIL);
    renderPage();
    await alertText();
    onlineManager.setOnline(false);
    await userEvent.click(retryButton());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(retryButton()).toHaveTextContent('Tentar de novo'));
    expect(retryButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('o botão mantém o foco enquanto o pedido corre (aria-disabled, não disabled)', async () => {
    myCompanies.mockRejectedValueOnce(FAIL);
    renderPage();
    await alertText();
    myCompanies.mockReturnValueOnce(new Promise(() => {}));
    await userEvent.click(retryButton());
    const button = await screen.findByRole('button', { name: /a tentar/i });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
  });
});
