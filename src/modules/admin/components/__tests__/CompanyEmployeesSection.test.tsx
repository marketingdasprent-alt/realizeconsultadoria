import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPANIES_ACTIVE_KEY } from '../../context/CompanyScopeContext';
import { CompanyEmployeesSection } from '../CompanyEmployeesSection';

const companyEmployees = vi.fn();
const employeesOutsideCompany = vi.fn();
const transferEmployee = vi.fn();
const transferEmployees = vi.fn();
vi.mock('../../services/companyMembershipService', () => ({
  companyMembershipService: {
    companyEmployees: (...args: unknown[]) => companyEmployees(...args),
    employeesOutsideCompany: (...args: unknown[]) => employeesOutsideCompany(...args),
    transferEmployee: (...args: unknown[]) => transferEmployee(...args),
    transferEmployees: (...args: unknown[]) => transferEmployees(...args),
  },
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const refreshSharing = vi.fn();
let myCompanies: { company_id: string; name: string; role: string }[] = [];
vi.mock('../../hooks/useSharing', () => ({
  useMyCompanies: () => ({ data: myCompanies, isLoading: false }),
  useRefreshSharing: () => refreshSharing,
}));

const ACME = { id: 'c1', name: 'Acme Lda', isActive: true };
const OTHER = { id: 'c2', name: 'Beta Lda', isActive: true };

const mine = (...ids: string[]) =>
  ids.map(id => ({ company_id: id, name: `Empresa ${id}`, role: 'admin' }));

const emp = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  email: `${id}@x.pt`,
  company_id: 'c1',
  user_id: `u-${id}`,
  is_active: true,
  position: null,
  department: null,
  ...extra,
});

const renderSection = (company = ACME) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={client}>
      <CompanyEmployeesSection company={company} />
    </QueryClientProvider>
  );
  const rerenderWith = (next: typeof ACME) =>
    view.rerender(
      <QueryClientProvider client={client}>
        <CompanyEmployeesSection company={next} />
      </QueryClientProvider>
    );
  return { invalidate, rerenderWith };
};

/** Abre o seletor, escolhe as fichas pelo nome e segue para o resumo de efeitos. */
const pickAndContinue = async (names: string[]) => {
  fireEvent.click(await screen.findByRole('button', { name: /Adicionar colaboradores/ }));
  for (const name of names) fireEvent.click(await screen.findByRole('checkbox', { name }));
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
};

beforeEach(() => {
  vi.clearAllMocks();
  myCompanies = mine('c1', 'c2');
  companyEmployees.mockResolvedValue([]);
  employeesOutsideCompany.mockResolvedValue([]);
});

describe('CompanyEmployeesSection', () => {
  it('mostra o estado de carregamento enquanto lê os colaboradores', () => {
    companyEmployees.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
  });

  it('lista os colaboradores ativos com cargo, departamento, "sem conta" e a contagem', async () => {
    companyEmployees.mockResolvedValue([
      emp('e1', 'Ana Silva', { position: 'Gestora', department: 'Vendas' }),
      emp('e2', 'Bruno Costa', { user_id: null }),
      emp('e3', 'Carla Reis'),
    ]);
    renderSection();
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText(/Gestora/)).toBeInTheDocument();
    expect(screen.getByText(/Vendas/)).toBeInTheDocument();
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
    expect(screen.getAllByText('Sem conta')).toHaveLength(1);
    expect(screen.getByText('3 colaboradores')).toBeInTheDocument();
    expect(companyEmployees).toHaveBeenCalledWith('c1');
  });

  it('usa um título h2 coerente com a página', async () => {
    renderSection();
    expect(await screen.findByRole('heading', { level: 2, name: 'Colaboradores' })).toBeVisible();
  });

  it('mostra o estado vazio quando a empresa não tem colaboradores', async () => {
    renderSection();
    expect(await screen.findByText('Esta empresa ainda não tem colaboradores')).toBeInTheDocument();
  });

  it('distingue o erro de leitura do vazio e deixa tentar outra vez', async () => {
    companyEmployees.mockRejectedValueOnce(new Error('rede'));
    renderSection();
    expect(await screen.findByText('Não foi possível carregar')).toBeInTheDocument();
    expect(screen.queryByText('Esta empresa ainda não tem colaboradores')).not.toBeInTheDocument();
    companyEmployees.mockResolvedValueOnce([emp('e1', 'Ana Silva')]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
  });

  it('só oferece pesquisa por nome quando há mais de 10 colaboradores', async () => {
    companyEmployees.mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => emp(`e${i}`, `Pessoa ${String.fromCharCode(65 + i)}`))
    );
    renderSection();
    const search = await screen.findByLabelText('Pesquisar na lista da empresa');
    fireEvent.change(search, { target: { value: 'pessoa c' } });
    expect(screen.getByText('Pessoa C')).toBeInTheDocument();
    expect(screen.queryByText('Pessoa D')).not.toBeInTheDocument();
  });

  it('não mostra a pesquisa com 10 colaboradores ou menos', async () => {
    companyEmployees.mockResolvedValue([emp('e1', 'Ana Silva')]);
    renderSection();
    await screen.findByText('Ana Silva');
    expect(screen.queryByLabelText('Pesquisar na lista da empresa')).not.toBeInTheDocument();
  });

  it('empresa inativa mostra aviso e desativa "Adicionar colaboradores"', async () => {
    renderSection({ ...ACME, isActive: false });
    expect(await screen.findByText(/está inativa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar colaboradores/ })).toBeDisabled();
  });

  it('quem não administra a empresa não vê a lista nem chama a base', async () => {
    myCompanies = mine('c9');
    renderSection();
    expect(await screen.findByText(/Só os administradores desta empresa/)).toBeInTheDocument();
    expect(companyEmployees).not.toHaveBeenCalled();
  });

  it('adicionar move as fichas escolhidas para esta empresa, uma só vez mesmo com duplo clique', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2', companyName: 'Beta Lda' }),
      emp('e3', 'Eva Matos', { company_id: 'c2', companyName: 'Beta Lda' }),
      emp('e4', 'Filipe Nunes', { company_id: 'c2', companyName: 'Beta Lda' }),
    ]);
    let release: (value: unknown) => void = () => {};
    transferEmployees.mockReturnValue(new Promise(resolve => (release = resolve)));
    renderSection();
    await pickAndContinue(['Dina Lopes', 'Eva Matos']);
    const move = await screen.findByRole('button', { name: 'Mover 2 colaboradores' });
    // Os dois cliques chegam antes de o React atualizar o botão para desativado
    act(() => {
      fireEvent.click(move);
      fireEvent.click(move);
    });
    expect(transferEmployees).toHaveBeenCalledTimes(1);
    expect(transferEmployees).toHaveBeenCalledWith(['e2', 'e3'], 'c1');
    release({
      total: 2,
      ok: 2,
      failed: 0,
      results: [
        { employee_id: 'e2', ok: true },
        { employee_id: 'e3', ok: true },
      ],
    });
    expect(await screen.findAllByText('Movido')).toHaveLength(2);
  });

  it('mostra o destino já fixo (esta empresa) sem pedir ao admin que o escolha', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2' }),
      emp('e3', 'Eva Matos', { company_id: 'c2' }),
    ]);
    renderSection();
    await pickAndContinue(['Dina Lopes', 'Eva Matos']);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Empresa de destino/)).toBeInTheDocument();
    expect(within(dialog).getByText('Acme Lda')).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('resultado parcial: a ficha recusada mostra o motivo e as outras ficam movidas', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2' }),
      emp('e3', 'Eva Matos', { company_id: 'c2' }),
    ]);
    transferEmployees.mockResolvedValue({
      total: 2,
      ok: 1,
      failed: 1,
      results: [
        { employee_id: 'e2', ok: true },
        {
          employee_id: 'e3',
          ok: false,
          error: 'unknown',
          detail: 'Já existe um colaborador com este email.',
        },
      ],
    });
    renderSection();
    await pickAndContinue(['Dina Lopes', 'Eva Matos']);
    fireEvent.click(await screen.findByRole('button', { name: 'Mover 2 colaboradores' }));
    expect(await screen.findByText('Movido')).toBeInTheDocument();
    expect(screen.getByText('Já existe um colaborador com este email.')).toBeInTheDocument();
  });

  it('fichas sem conta aparecem no seletor como não movíveis, com o motivo', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2', user_id: null }),
      emp('e3', 'Eva Matos', { company_id: 'c2' }),
    ]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar colaboradores/ }));
    expect(await screen.findByRole('checkbox', { name: 'Dina Lopes' })).toBeDisabled();
    expect(screen.getByText(/ainda não tem conta de utilizador/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Eva Matos' })).toBeEnabled();
  });

  it('fichas de empresas que o admin não administra aparecem como não movíveis', async () => {
    employeesOutsideCompany.mockResolvedValue([emp('e5', 'Gil Pinto', { company_id: 'c3' })]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar colaboradores/ }));
    expect(await screen.findByRole('checkbox', { name: 'Gil Pinto' })).toBeDisabled();
    expect(screen.getByText(/não administra a empresa atual/)).toBeInTheDocument();
  });

  it('o seletor pesquisa por nome e o botão Continuar começa desativado', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2' }),
      emp('e3', 'Eva Matos', { company_id: 'c2' }),
    ]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar colaboradores/ }));
    expect(await screen.findByRole('button', { name: /Continuar/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Pesquisar colaboradores de outras empresas'), {
      target: { value: 'eva' },
    });
    expect(screen.queryByRole('checkbox', { name: 'Dina Lopes' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Eva Matos' })).toBeInTheDocument();
  });

  it('depois de mover relê esta lista, o seletor de empresas e os administradores candidatos', async () => {
    employeesOutsideCompany.mockResolvedValue([
      emp('e2', 'Dina Lopes', { company_id: 'c2' }),
      emp('e3', 'Eva Matos', { company_id: 'c2' }),
    ]);
    transferEmployees.mockResolvedValue({
      total: 2,
      ok: 2,
      failed: 0,
      results: [
        { employee_id: 'e2', ok: true },
        { employee_id: 'e3', ok: true },
      ],
    });
    const { invalidate } = renderSection();
    await pickAndContinue(['Dina Lopes', 'Eva Matos']);
    fireEvent.click(await screen.findByRole('button', { name: 'Mover 2 colaboradores' }));
    await screen.findAllByText('Movido');
    const keys = invalidate.mock.calls.map(call => (call[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual(['admin', 'company-employees']);
    expect(keys).toContainEqual(['admin', 'company-employees-with-account']);
    expect(keys).toContainEqual([...COMPANIES_ACTIVE_KEY]);
    expect(refreshSharing).toHaveBeenCalled();
  });

  it('"Mover para outra empresa…" por linha abre o diálogo dessa ficha', async () => {
    companyEmployees.mockResolvedValue([emp('e1', 'Ana Silva')]);
    renderSection();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mover Ana Silva para outra empresa' })
    );
    expect(
      await screen.findByRole('heading', { name: 'Mover Ana Silva para outra empresa' })
    ).toBeInTheDocument();
    expect(screen.getByText('Empresa de destino')).toBeInTheDocument();
  });

  it('ao mudar de :id não mostra a lista da empresa anterior', async () => {
    companyEmployees.mockImplementation((id: string) =>
      id === 'c1' ? Promise.resolve([emp('e1', 'Ana Silva')]) : new Promise(() => {})
    );
    const { rerenderWith } = renderSection();
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    rerenderWith(OTHER);
    await waitFor(() => expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
  });
});
