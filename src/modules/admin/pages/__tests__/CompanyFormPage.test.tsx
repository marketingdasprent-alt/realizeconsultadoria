import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyFormPage from '../CompanyFormPage';

const getById = vi.fn();
const createWithAdmin = vi.fn();
const update = vi.fn();
vi.mock('@/modules/admin/services/companyService', () => ({
  companyService: {
    getById: (...args: unknown[]) => getById(...args),
    createWithAdmin: (...args: unknown[]) => createWithAdmin(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

let canManage = true;
let isSuperAdmin = true;
let permissionsLoading = false;
let canViewSharing = true;
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    isLoading: permissionsLoading,
    isSuperAdmin,
    canExecuteTopic: () => canManage,
    canView: (module: string) => (module === 'sharing' ? canViewSharing : true),
  }),
}));

// As empresas que a conta administra (a Partilha só aparece para estas).
const refetchMine = vi.fn();
const myCompanies: {
  data: { company_id: string; role: string }[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
} = {
  data: [{ company_id: 'c1', role: 'admin' }],
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: () => refetchMine(),
};
vi.mock('../../hooks/useSharing', () => ({
  useAllGroups: () => ({ data: [] }),
  useMyCompanies: () => myCompanies,
}));

vi.mock('../../components/company/CompanySharing', () => ({
  CompanySharing: ({ company }: { company: { id: string; name: string } }) => (
    <div data-testid="sharing-section">Partilha de {company.name}</div>
  ),
}));

vi.mock('../../components/CompanyAdminsSection', () => ({
  CompanyAdminsSection: ({ company }: { company: { id: string; name: string } }) => (
    <div data-testid="admins-section">Administradores de {company.name}</div>
  ),
}));

vi.mock('../../components/CompanyEmployeesSection', () => ({
  CompanyEmployeesSection: ({
    company,
  }: {
    company: { id: string; name: string; isActive: boolean };
  }) => (
    <div data-testid="employees-section">
      Colaboradores de {company.name} ({company.id}, {company.isActive ? 'ativa' : 'inativa'})
    </div>
  ),
}));

const COMPANY = {
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
};

/** Mostra o caminho e liga a outra empresa sem desmontar a página (como um link ou o seletor). */
const Where = () => {
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="where">{useLocation().pathname}</div>
      <button type="button" onClick={() => navigate('/admin/empresas/c3')}>
        ir para c3
      </button>
      <button type="button" onClick={() => navigate('/admin/empresas')}>
        ir para a lista
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        voltar do browser
      </button>
    </>
  );
};

let queryClient: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/admin/empresas" element={<div>Lista de empresas</div>} />
          <Route path="/admin/empresas/nova" element={<CompanyFormPage />} />
          <Route path="/admin/empresas/:id" element={<CompanyFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

/** Tudo o que alguma vez foi pintado no ecrã (o React pode mostrar um estado só por um instante). */
const watchTexts = () => {
  const seen: string[] = [];
  const collect = (records: MutationRecord[]) =>
    records.forEach(record => record.addedNodes.forEach(node => seen.push(node.textContent ?? '')));
  const observer = new MutationObserver(collect);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    everSaw: (text: string) => {
      collect(observer.takeRecords());
      return seen.some(value => value.includes(text));
    },
    stop: () => observer.disconnect(),
  };
};

const fill = () => {
  fireEvent.change(screen.getByLabelText(/nome da empresa/i), { target: { value: 'Nova Lda' } });
  fireEvent.change(screen.getByLabelText(/^nif/i), { target: { value: '987654321' } });
  fireEvent.change(screen.getByLabelText(/^email \*/i), { target: { value: 'nova@lda.pt' } });
  fireEvent.change(screen.getByLabelText(/nome do administrador/i), {
    target: { value: 'Ana Admin' },
  });
  fireEvent.change(screen.getByLabelText(/email do administrador/i), {
    target: { value: 'ana@nova.pt' },
  });
  fireEvent.change(screen.getByLabelText(/palavra-passe inicial/i), {
    target: { value: 'segredo123' },
  });
};

const PGRST116 = {
  code: 'PGRST116',
  message: 'JSON object requested, multiple (or no) rows returned',
};

const COMPANIES_ACTIVE = { queryKey: ['admin', 'companies-active'] };

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  canManage = true;
  isSuperAdmin = true;
  permissionsLoading = false;
  getById.mockResolvedValue({ data: COMPANY, error: null });
  update.mockResolvedValue({ data: { ...COMPANY, name: 'Acme Novo' }, error: null });
  createWithAdmin.mockResolvedValue({ data: { ...COMPANY, id: 'c2' }, error: null });
  canViewSharing = true;
  myCompanies.data = [{ company_id: 'c1', role: 'admin' }];
  myCompanies.isLoading = false;
  myCompanies.error = null;
  myCompanies.isFetching = false;
  refetchMine.mockReset();
});

describe('CompanyFormPage — edição', () => {
  it('carrega a empresa por id e abre nos Dados, com os separadores da ficha', async () => {
    renderAt('/admin/empresas/c1');
    expect(await screen.findByDisplayValue('Acme Lda')).toBeInTheDocument();
    expect(getById).toHaveBeenCalledWith('c1');
    expect(screen.getByRole('heading', { name: 'Acme Lda' })).toBeInTheDocument();
    expect(screen.getByText('Dados da empresa')).toBeInTheDocument();
    for (const name of ['Dados', 'Administradores', 'Colaboradores', 'Partilha']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('tab', { name: 'Dados' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
  });

  it('?tab=administradores abre os administradores desta empresa', async () => {
    renderAt('/admin/empresas/c1?tab=administradores');
    expect(await screen.findByTestId('admins-section')).toHaveTextContent('Acme Lda');
  });

  it('mostra a secção Colaboradores com o estado da empresa', async () => {
    getById.mockResolvedValue({ data: { ...COMPANY, is_active: false }, error: null });
    renderAt('/admin/empresas/c1?tab=colaboradores');
    const employees = await screen.findByTestId('employees-section');
    expect(employees).toHaveTextContent('Colaboradores de Acme Lda (c1, inativa)');
  });

  it('mudar de separador não apaga o que ainda não foi guardado em Dados', async () => {
    const user = userEvent.setup();
    renderAt('/admin/empresas/c1');
    const name = await screen.findByDisplayValue('Acme Lda');
    fireEvent.change(name, { target: { value: 'Acme Editada' } });
    await user.click(screen.getByRole('tab', { name: 'Administradores' }));
    expect(await screen.findByTestId('admins-section')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Dados' }));
    expect(screen.getByDisplayValue('Acme Editada')).toBeInTheDocument();
  });

  describe('separador Partilha (era a página "Partilha entre empresas")', () => {
    it('?tab=partilha abre a Partilha com a empresa fixada (sem escolher empresa)', async () => {
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByTestId('sharing-section')).toHaveTextContent('Acme Lda');
    });

    it('sem a permissão "sharing" não há separador Partilha e o endereço cai em Dados', async () => {
      canViewSharing = false;
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByDisplayValue('Acme Lda')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Partilha' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('sharing-section')).not.toBeInTheDocument();
    });

    it('quem não administra esta empresa não vê a Partilha dela', async () => {
      myCompanies.data = [{ company_id: 'c1', role: 'colaborador' }];
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByDisplayValue('Acme Lda')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Partilha' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('sharing-section')).not.toBeInTheDocument();
    });

    it('um super admin (papel super_admin) vê a Partilha de qualquer empresa', async () => {
      myCompanies.data = [{ company_id: 'c1', role: 'super_admin' }];
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByTestId('sharing-section')).toBeInTheDocument();
    });

    it('?tab=partilha sem direito: aviso claro em vez de cair em Dados calado', async () => {
      myCompanies.data = [{ company_id: 'c1', role: 'colaborador' }];
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByRole('alert')).toHaveTextContent(/não tem acesso à partilha/i);
      expect(screen.queryByTestId('sharing-section')).not.toBeInTheDocument();
    });

    it('?tab=partilha com erro a ler as empresas da conta: aviso com "Tentar de novo"', async () => {
      myCompanies.data = undefined;
      myCompanies.error = new Error('rede');
      renderAt('/admin/empresas/c1?tab=partilha');
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/não foi possível carregar a partilha/i);
      await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
      expect(refetchMine).toHaveBeenCalledTimes(1);
    });

    it('sem dados e sem erro (pedido em pausa, offline): também "Tentar de novo", nunca "sem acesso"', async () => {
      myCompanies.data = undefined;
      renderAt('/admin/empresas/c1?tab=partilha');
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/não foi possível carregar a partilha/i);
      expect(alert).not.toHaveTextContent(/não tem acesso/i);
    });

    it('um erro de fundo com dados já lidos que dizem "não administra" continua a ser "sem acesso"', async () => {
      myCompanies.data = [{ company_id: 'c1', role: 'colaborador' }];
      myCompanies.error = new Error('rede');
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByRole('alert')).toHaveTextContent(/não tem acesso à partilha/i);
    });

    it('sem a permissão "sharing" o aviso é "sem acesso", sem "Tentar de novo"', async () => {
      canViewSharing = false;
      myCompanies.data = undefined;
      myCompanies.error = new Error('rede');
      renderAt('/admin/empresas/c1?tab=partilha');
      expect(await screen.findByRole('alert')).toHaveTextContent(/não tem acesso à partilha/i);
      expect(screen.queryByRole('button', { name: /tentar de novo/i })).not.toBeInTheDocument();
    });

    it('ao clicar "Tentar de novo" o aviso fica montado (o React Query repõe isLoading e apaga o erro)', async () => {
      myCompanies.data = undefined;
      myCompanies.error = new Error('rede');
      // Como o React Query real: sem dados, o novo pedido volta a "pending" e o erro desaparece
      refetchMine.mockImplementation(() => {
        myCompanies.error = null;
        myCompanies.isLoading = true;
        myCompanies.isFetching = true;
        return new Promise(() => {});
      });
      renderAt('/admin/empresas/c1?tab=partilha');
      await userEvent.click(await screen.findByRole('button', { name: /tentar de novo/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /a tentar/i })).toBeDisabled();
    });

    it('acesso recém-dado: a ler de novo com dados antigos não mostra "sem acesso" de relance', async () => {
      myCompanies.data = [];
      myCompanies.isFetching = true;
      renderAt('/admin/empresas/c1?tab=partilha');
      await screen.findByRole('heading', { name: 'Acme Lda' });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('sem ?tab=partilha não há aviso', async () => {
      myCompanies.data = [{ company_id: 'c1', role: 'colaborador' }];
      renderAt('/admin/empresas/c1');
      await screen.findByDisplayValue('Acme Lda');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('enquanto as empresas da conta carregam não cai em Dados nem decide', async () => {
      myCompanies.data = [];
      myCompanies.isLoading = true;
      renderAt('/admin/empresas/c1?tab=partilha');
      await screen.findByRole('heading', { name: 'Acme Lda' });
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('sharing-section')).not.toBeInTheDocument();
    });
  });

  it('empresa não encontrada: mensagem e voltar à lista', async () => {
    getById.mockResolvedValue({ data: null, error: PGRST116 });
    renderAt('/admin/empresas/xx');
    expect(await screen.findByText('Empresa não encontrada')).toBeInTheDocument();
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('employees-section')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /voltar às empresas/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas');
    expect(screen.getByText('Lista de empresas')).toBeInTheDocument();
  });

  it('guardar chama update, mostra o toast e fica na página', async () => {
    renderAt('/admin/empresas/c1');
    const name = await screen.findByDisplayValue('Acme Lda');
    fireEvent.change(name, { target: { value: 'Acme Novo' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Acme Novo' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'Empresa atualizada com sucesso!' })
    );
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
    expect(screen.getByRole('tab', { name: 'Dados' })).toHaveAttribute('data-state', 'active');
  });

  it('erro ao guardar mostra o erro e não sai da página', async () => {
    update.mockResolvedValue({ data: null, error: new Error('NIF duplicado') });
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Erro',
        description: 'NIF duplicado',
        variant: 'destructive',
      })
    );
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1');
  });

  it('o botão voltar regressa à lista', async () => {
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    fireEvent.click(screen.getByRole('button', { name: /voltar às empresas/i }));
    expect(screen.getByText('Lista de empresas')).toBeInTheDocument();
  });

  it('sem permissão de gerir: não mostra o formulário nem os administradores', async () => {
    canManage = false;
    renderAt('/admin/empresas/c1');
    expect(await screen.findByText(/não tem permissão/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar alterações/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('employees-section')).not.toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
  });

  it('espera pelas permissões: mostra o carregamento e não decide ainda', () => {
    permissionsLoading = true;
    canManage = false;
    renderAt('/admin/empresas/c1');
    expect(screen.getByRole('status')).toHaveTextContent('A carregar…');
    expect(screen.queryByText(/não tem permissão/i)).not.toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
  });
});

describe('CompanyFormPage — criação', () => {
  it('mostra o formulário vazio e não mostra os administradores nem os colaboradores', async () => {
    renderAt('/admin/empresas/nova');
    expect(await screen.findByRole('heading', { name: 'Nova empresa' })).toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('employees-section')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar empresa/i })).toBeInTheDocument();
  });

  it('só um super admin cria empresas', async () => {
    isSuperAdmin = false;
    renderAt('/admin/empresas/nova');
    expect(await screen.findByText(/só um super administrador cria empresas/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /criar empresa/i })).not.toBeInTheDocument();
  });

  it('criar envia a empresa, o primeiro administrador e o grupo (sem insert direto)', async () => {
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(createWithAdmin).toHaveBeenCalledTimes(1));
    expect(createWithAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nova Lda',
        nif: '987654321',
        email: 'nova@lda.pt',
        admin_name: 'Ana Admin',
        admin_email: 'ana@nova.pt',
        admin_password: 'segredo123',
        group_id: '',
        group_name: '',
      })
    );
  });

  it('sem os dados do administrador não cria', async () => {
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fireEvent.change(screen.getByLabelText(/nome da empresa/i), { target: { value: 'Nova Lda' } });
    fireEvent.change(screen.getByLabelText(/^nif/i), { target: { value: '987654321' } });
    fireEvent.change(screen.getByLabelText(/^email \*/i), { target: { value: 'nova@lda.pt' } });
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    expect(await screen.findByText(/indique o nome do administrador/i)).toBeInTheDocument();
    expect(createWithAdmin).not.toHaveBeenCalled();
  });

  it('criar com id devolvido navega para a página de edição dessa empresa', async () => {
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(createWithAdmin).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'Empresa criada com sucesso!' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c2')
    );
  });

  it('criar sem id devolvido volta à lista', async () => {
    createWithAdmin.mockResolvedValue({ data: null, error: null });
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(screen.getByText('Lista de empresas')).toBeInTheDocument());
  });
});

describe('CompanyFormPage — fluxo de guardar e navegar', () => {
  it('depois de criar nunca aparece "Empresa não encontrada" enquanto a nova carrega', async () => {
    let finish: (value: unknown) => void = () => {};
    getById.mockReturnValue(new Promise(resolve => (finish = resolve)));
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    const watch = watchTexts();
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c2')
    );
    expect(screen.queryByText('Empresa não encontrada')).not.toBeInTheDocument();
    await act(async () =>
      finish({ data: { ...COMPANY, id: 'c2', name: 'Nova Lda' }, error: null })
    );
    expect(await screen.findByDisplayValue('Nova Lda')).toBeInTheDocument();
    expect(watch.everSaw('Empresa não encontrada')).toBe(false);
    watch.stop();
  });

  it('ao mudar de :id não se mostram dados da empresa anterior', async () => {
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    let finish: (value: unknown) => void = () => {};
    getById.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const watch = watchTexts();
    // O mesmo ecrã passa para outra empresa (sem desmontar)
    fireEvent.click(screen.getByRole('button', { name: 'ir para c3' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c3');
    expect(screen.queryByDisplayValue('Acme Lda')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
    expect(screen.queryByText('Empresa não encontrada')).not.toBeInTheDocument();
    await act(async () =>
      finish({ data: { ...COMPANY, id: 'c3', name: 'Terceira SA' }, error: null })
    );
    expect(await screen.findByDisplayValue('Terceira SA')).toBeInTheDocument();
    expect(watch.everSaw('Empresa não encontrada')).toBe(false);
    watch.stop();
  });

  it('invalida o seletor de empresas depois de atualizar, não em erro', async () => {
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    update.mockResolvedValueOnce({ data: null, error: new Error('falhou') });
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro' }))
    );
    expect(invalidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(COMPANIES_ACTIVE));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('invalida o seletor depois de criar, e não se a criação falha', async () => {
    createWithAdmin.mockResolvedValueOnce({ data: null, error: new Error('NIF duplicado') });
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro' }))
    );
    expect(invalidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith(COMPANIES_ACTIVE));
  });

  it('dois envios seguidos chamam create uma só vez', async () => {
    let finish: (value: unknown) => void = () => {};
    createWithAdmin.mockReturnValue(new Promise(resolve => (finish = resolve)));
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    const form = screen.getByRole('button', { name: /criar empresa/i }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(createWithAdmin).toHaveBeenCalledTimes(1));
    await act(async () => finish({ data: { ...COMPANY, id: 'c2' }, error: null }));
    expect(createWithAdmin).toHaveBeenCalledTimes(1);
  });

  it('o texto cru do PostgREST (0 linhas) vira mensagem em português', async () => {
    update.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    });
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Erro',
        description: 'Não foi possível guardar a empresa.',
        variant: 'destructive',
      })
    );
  });

  it('mantém as mensagens úteis, mesmo quando o erro não é um Error', async () => {
    update.mockResolvedValue({ data: null, error: { message: 'duplicate key value (nif)' } });
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Erro',
        description: 'duplicate key value (nif)',
        variant: 'destructive',
      })
    );
  });

  it('Voltar do browser de /empresas/c2 para /nova mostra o formulário vazio, não os dados de c2', async () => {
    getById.mockResolvedValue({ data: { ...COMPANY, id: 'c2', name: 'Criada Lda' }, error: null });
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    expect(await screen.findByDisplayValue('Criada Lda')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c2');

    fireEvent.click(screen.getByRole('button', { name: 'voltar do browser' }));

    expect(await screen.findByRole('heading', { name: 'Nova empresa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar empresa/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Criada Lda')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nome da empresa/i)).toHaveValue('');
    expect(screen.getByLabelText(/^nif/i)).toHaveValue('');
    expect(screen.queryByTestId('admins-section')).not.toBeInTheDocument();
  });

  it('guardar e mudar de empresa a meio: o resultado antigo não apaga a empresa nova', async () => {
    let finishUpdate: (value: unknown) => void = () => {};
    update.mockReturnValue(new Promise(resolve => (finishUpdate = resolve)));
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    fireEvent.click(screen.getByRole('button', { name: /guardar alterações/i }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    getById.mockResolvedValue({ data: { ...COMPANY, id: 'c3', name: 'Terceira SA' }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'ir para c3' }));
    expect(await screen.findByDisplayValue('Terceira SA')).toBeInTheDocument();

    await act(async () => finishUpdate({ data: { ...COMPANY, name: 'Acme Novo' }, error: null }));

    expect(screen.getByDisplayValue('Terceira SA')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Acme Novo')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c3');
  });

  it('criar e sair da página a meio: terminada a criação não volta a arrastar o utilizador', async () => {
    let finishCreate: (value: unknown) => void = () => {};
    createWithAdmin.mockReturnValue(new Promise(resolve => (finishCreate = resolve)));
    renderAt('/admin/empresas/nova');
    await screen.findByRole('heading', { name: 'Nova empresa' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(createWithAdmin).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'ir para a lista' }));
    expect(screen.getByText('Lista de empresas')).toBeInTheDocument();

    await act(async () => finishCreate({ data: { ...COMPANY, id: 'c2' }, error: null }));

    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/empresas$/);
    expect(screen.getByText('Lista de empresas')).toBeInTheDocument();
  });
});

describe('CompanyFormPage — erros de leitura', () => {
  it('erro que não é "não existe" mostra "Não foi possível carregar" e deixa tentar de novo', async () => {
    getById.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    renderAt('/admin/empresas/c1');
    expect(await screen.findByText('Não foi possível carregar a empresa.')).toBeInTheDocument();
    expect(screen.queryByText('Empresa não encontrada')).not.toBeInTheDocument();
    expect(screen.queryByText(/já foi eliminada/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));

    expect(await screen.findByDisplayValue('Acme Lda')).toBeInTheDocument();
    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('leitura que rejeita não deixa o carregamento preso', async () => {
    getById.mockRejectedValueOnce(new Error('rede em baixo'));
    renderAt('/admin/empresas/c1');
    expect(await screen.findByText('Não foi possível carregar a empresa.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('empresa inexistente (PGRST116) continua a dizer "Empresa não encontrada"', async () => {
    getById.mockResolvedValue({ data: null, error: PGRST116 });
    renderAt('/admin/empresas/xx');
    expect(await screen.findByText('Empresa não encontrada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentar de novo/i })).not.toBeInTheDocument();
  });
});

describe('CompanyFormPage — títulos', () => {
  it('a hierarquia de títulos não salta: h1 e depois h2 "Dados da empresa"', async () => {
    renderAt('/admin/empresas/c1');
    await screen.findByDisplayValue('Acme Lda');
    expect(screen.getByRole('heading', { level: 1, name: 'Acme Lda' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Dados da empresa' })).toBeInTheDocument();
  });
});
