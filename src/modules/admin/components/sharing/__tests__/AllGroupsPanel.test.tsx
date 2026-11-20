import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../../lib/sharing';
import { AllGroupsPanel } from '../AllGroupsPanel';

const svc = vi.hoisted(() => ({
  listAllGroups: vi.fn(),
  myCompanies: vi.fn(),
  capabilities: vi.fn(),
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  setGroupMembers: vi.fn(),
  setGroupCapabilities: vi.fn(),
  dissolveGroup: vi.fn(),
}));
vi.mock('../../../services/sharingService', () => ({ sharingService: svc }));

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

// O diálogo real pede a palavra-passe ao Supabase: aqui só confirma ou desiste.
vi.mock('../ReauthDialog', () => ({
  ReauthDialog: ({ open, onDone }: { open: boolean; onDone: (ok: boolean) => void }) =>
    open ? (
      <div role="alertdialog" aria-label="Reautenticar">
        <button type="button" onClick={() => onDone(true)}>
          Confirmar palavra-passe
        </button>
        <button type="button" onClick={() => onDone(false)}>
          Desistir
        </button>
      </div>
    ) : null,
}));

// O jsdom não tem ResizeObserver, que o Radix usa nas caixas de seleção dentro de um formulário
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const company = (id: string, name: string) => ({
  company_id: id,
  name,
  role: 'super_admin',
  status: 'ativo',
  origin: 'plataforma',
  is_group_member: false,
});
const COMPANIES = ['a', 'b', 'c', 'd', 'e', 'f'].map(id =>
  company(id, `Empresa ${id.toUpperCase()}`)
);

const member = (groupId: string, groupName: string, id: string, caps: string[]) => ({
  group_id: groupId,
  group_name: groupName,
  group_created_at: '2026-11-17T10:00:00Z',
  company_id: id,
  company_name: `Empresa ${id.toUpperCase()}`,
  joined_at: '2026-11-17T10:00:00Z',
  origin: 'migracao' as const,
  default_capabilities: caps,
});
const GROUP_ROWS = [
  member('g1', 'Grupo Realize', 'a', ['directory.read']),
  member('g1', 'Grupo Realize', 'b', ['directory.read']),
  member('g2', 'Grupo Urbango', 'e', []),
  member('g2', 'Grupo Urbango', 'f', []),
];

const capability = (code: string, module: string, description: string, over = {}) => ({
  capability: code,
  module,
  kind: 'read',
  grantable: true,
  sensitive: false,
  min_role: 'colaborador',
  description,
  ...over,
});
const CATALOG = [
  capability('directory.read', 'directory', 'Ver colaboradores'),
  capability('feed.read', 'feed', 'Ver comunicados do grupo'),
  capability('tickets.read', 'tickets', 'Ver tickets'),
  capability('tickets.write', 'tickets', 'Gerir tickets', { kind: 'write' }),
  capability('access.reveal', 'access', 'Ver palavras-passe', { sensitive: true }),
  capability('hr.read', 'hr', 'Ver recursos humanos', { grantable: false }),
];

let client: QueryClient;
const renderPanel = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AllGroupsPanel />
    </QueryClientProvider>
  );
};

const openDialog = async (button: string) => {
  const trigger = await screen.findByRole('button', { name: button });
  // Os botões ficam desativados enquanto a lista carrega
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  svc.listAllGroups.mockResolvedValue(GROUP_ROWS);
  svc.myCompanies.mockResolvedValue(COMPANIES);
  svc.capabilities.mockResolvedValue(CATALOG);
  svc.createGroup.mockResolvedValue({ group_id: 'g9' });
  svc.renameGroup.mockResolvedValue({ group_id: 'g1', name: 'x' });
  svc.setGroupMembers.mockResolvedValue({ group_id: 'g1', added: 1, removed: 0, revoked: 0 });
  svc.setGroupCapabilities.mockResolvedValue({ group_id: 'g1', capabilities: [] });
  svc.dissolveGroup.mockResolvedValue({ group_id: 'g1', revoked: 2 });
});

describe('AllGroupsPanel — leitura', () => {
  it('mostra o carregamento e depois os grupos, as empresas e os módulos de cada um', async () => {
    svc.listAllGroups.mockReturnValue(new Promise(() => {}));
    const view = renderPanel();
    expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
    view.unmount();

    svc.listAllGroups.mockResolvedValue(GROUP_ROWS);
    renderPanel();
    const group = await screen.findByRole('region', { name: 'Grupo Realize' });
    expect(within(group).getByText('Empresa A')).toBeInTheDocument();
    expect(within(group).getByText(/Colaboradores/)).toBeInTheDocument();
    const other = screen.getByRole('region', { name: 'Grupo Urbango' });
    expect(within(other).getByText('Nada por defeito')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Empresas sem grupo' })).toBeInTheDocument();
  });

  it('tem título h2 e o texto verdadeiro sobre os módulos do grupo, com a nota de que ainda não têm efeito', async () => {
    renderPanel();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Grupos de empresas' })
    ).toBeVisible();
    expect(
      screen.getByText(
        /Os módulos do grupo definem o que as empresas veem umas das outras \(só leitura\); o resto só com partilha aprovada\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/ainda não têm efeito/)).toBeInTheDocument();
    expect(screen.getByText(/O Feed do grupo já mostra/)).toBeInTheDocument();
    expect(screen.queryByText(/não dá acesso/)).not.toBeInTheDocument();
  });

  it('distingue o erro de leitura do vazio e deixa tentar outra vez', async () => {
    svc.listAllGroups.mockRejectedValueOnce(new SharingError('forbidden'));
    renderPanel();
    expect(await screen.findByText('Não foi possível carregar')).toBeInTheDocument();
    expect(screen.queryByText('Ainda não há grupos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByRole('region', { name: 'Grupo Realize' })).toBeInTheDocument();
  });

  it('sem grupos nem empresas mostra o vazio', async () => {
    svc.listAllGroups.mockResolvedValue([]);
    svc.myCompanies.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('Ainda não há grupos')).toBeInTheDocument();
  });
});

describe('AllGroupsPanel — novo grupo', () => {
  it('só deixa criar com nome e pelo menos 2 empresas, e as de outro grupo aparecem recusadas com o motivo', async () => {
    renderPanel();
    const dialog = await openDialog('Novo grupo');
    const create = within(dialog).getByRole('button', { name: 'Criar grupo' });
    expect(create).toBeDisabled();
    expect(within(dialog).getByRole('checkbox', { name: 'Empresa A' })).toBeDisabled();
    expect(
      within(dialog).getAllByText('Já pertence ao grupo Grupo Realize').length
    ).toBeGreaterThan(0);
    fireEvent.change(within(dialog).getByLabelText('Nome do grupo'), {
      target: { value: 'Grupo Novo' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa C' }));
    expect(create).toBeDisabled();
    expect(within(dialog).getByText('Escolha pelo menos 2 empresas.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa D' }));
    expect(create).toBeEnabled();
  });

  it('oferece só módulos de leitura, partilháveis e não sensíveis, com diretório e Feed ligados', async () => {
    renderPanel();
    const dialog = await openDialog('Novo grupo');
    expect(
      await within(dialog).findByRole('checkbox', { name: 'Ver colaboradores' })
    ).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Ver comunicados do grupo' })
    ).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Ver tickets' })).not.toBeChecked();
    for (const hidden of ['Gerir tickets', 'Ver palavras-passe', 'Ver recursos humanos'])
      expect(within(dialog).queryByRole('checkbox', { name: hidden })).not.toBeInTheDocument();
  });

  it('cria o grupo com as empresas e os módulos escolhidos, uma só vez mesmo com duplo clique, e fecha', async () => {
    renderPanel();
    const dialog = await openDialog('Novo grupo');
    fireEvent.change(within(dialog).getByLabelText('Nome do grupo'), {
      target: { value: 'Grupo Novo' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa C' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa D' }));
    await within(dialog).findByRole('checkbox', { name: 'Ver colaboradores' });
    const create = within(dialog).getByRole('button', { name: 'Criar grupo' });
    // Os dois cliques chegam antes de o React atualizar o botão para desativado
    act(() => {
      fireEvent.click(create);
      fireEvent.click(create);
    });
    expect(svc.createGroup).toHaveBeenCalledTimes(1);
    expect(svc.createGroup).toHaveBeenCalledWith(
      'Grupo Novo',
      ['c', 'd'],
      ['directory.read', 'feed.read']
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith({ title: 'Grupo criado' });
    // A lista é relida depois de criar
    expect(svc.listAllGroups.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('mostra o texto em português da base e mantém o diálogo aberto quando a criação falha', async () => {
    svc.createGroup.mockRejectedValue(
      new SharingError('invalid_argument', 'A empresa Empresa C já pertence a um grupo.')
    );
    renderPanel();
    const dialog = await openDialog('Novo grupo');
    fireEvent.change(within(dialog).getByLabelText('Nome do grupo'), { target: { value: 'G' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa C' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa D' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Não foi possível concluir',
        description: 'A empresa Empresa C já pertence a um grupo.',
        variant: 'destructive',
      })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('quando a base pede a palavra-passe, confirma e repete a chamada uma vez', async () => {
    svc.createGroup
      .mockRejectedValueOnce(new SharingError('reauth_required'))
      .mockResolvedValueOnce({ group_id: 'g9' });
    renderPanel();
    const dialog = await openDialog('Novo grupo');
    fireEvent.change(within(dialog).getByLabelText('Nome do grupo'), { target: { value: 'G' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa C' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa D' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar grupo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar palavra-passe' }));
    await waitFor(() => expect(svc.createGroup).toHaveBeenCalledTimes(2));
    expect(toast).toHaveBeenCalledWith({ title: 'Grupo criado' });
  });
});

describe('AllGroupsPanel — gerir um grupo', () => {
  it('renomear: o nome vem preenchido e guarda o novo', async () => {
    renderPanel();
    const dialog = await openDialog('Renomear Grupo Realize');
    const name = within(dialog).getByLabelText('Nome do grupo');
    expect(name).toHaveValue('Grupo Realize');
    fireEvent.change(name, { target: { value: 'Realize Global' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(svc.renameGroup).toHaveBeenCalledWith('g1', 'Realize Global'));
    expect(svc.renameGroup).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ title: 'Grupo renomeado' });
  });

  it('renomear: nome vazio não se pode guardar', async () => {
    renderPanel();
    const dialog = await openDialog('Renomear Grupo Realize');
    fireEvent.change(within(dialog).getByLabelText('Nome do grupo'), { target: { value: '   ' } });
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('gerir empresas: as do grupo vêm marcadas, as de outro grupo recusadas com o motivo, e guarda o conjunto completo', async () => {
    renderPanel();
    const dialog = await openDialog('Gerir empresas de Grupo Realize');
    expect(within(dialog).getByRole('checkbox', { name: 'Empresa A' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Empresa B' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Empresa E' })).toBeDisabled();
    expect(
      within(dialog).getAllByText('Já pertence ao grupo Grupo Urbango').length
    ).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa C' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(svc.setGroupMembers).toHaveBeenCalledWith('g1', ['a', 'b', 'c']));
    expect(toast).toHaveBeenCalledWith({ title: 'Empresas do grupo atualizadas' });
  });

  it('gerir empresas: retirar uma avisa que as partilhas são revogadas; ficar com 1 manda usar Dissolver', async () => {
    renderPanel();
    const dialog = await openDialog('Gerir empresas de Grupo Realize');
    expect(within(dialog).queryByText(/partilhas dela com as outras/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empresa A' }));
    expect(within(dialog).getByText(/partilhas dela com as outras/)).toBeInTheDocument();
    expect(within(dialog).getByText(/use Dissolver/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('módulos: só os elegíveis, com os do grupo marcados, e guarda a nova lista', async () => {
    renderPanel();
    const dialog = await openDialog('Módulos de Grupo Realize');
    expect(
      await within(dialog).findByRole('checkbox', { name: 'Ver colaboradores' })
    ).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Ver comunicados do grupo' })
    ).not.toBeChecked();
    expect(
      within(dialog).queryByRole('checkbox', { name: 'Ver palavras-passe' })
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Ver comunicados do grupo' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(svc.setGroupCapabilities).toHaveBeenCalledWith('g1', ['directory.read', 'feed.read'])
    );
    expect(toast).toHaveBeenCalledWith({ title: 'Módulos do grupo atualizados' });
  });

  it('módulos: o catálogo a falhar mostra erro com tentar outra vez e não deixa guardar', async () => {
    svc.capabilities.mockRejectedValueOnce(new SharingError('forbidden'));
    renderPanel();
    const dialog = await openDialog('Módulos de Grupo Realize');
    expect(await within(dialog).findByText('Não foi possível carregar')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('dissolver: explica que as partilhas são revogadas e só dissolve depois de confirmar', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Dissolver Grupo Realize' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(/partilhas entre as empresas deste grupo serão revogadas/)
    ).toBeInTheDocument();
    expect(svc.dissolveGroup).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: 'Dissolver grupo' });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(svc.dissolveGroup).toHaveBeenCalledWith('g1'));
    expect(svc.dissolveGroup).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ title: 'Grupo dissolvido' });
  });

  it('dissolver: cancelar não chama a base', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Dissolver Grupo Realize' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(svc.dissolveGroup).not.toHaveBeenCalled();
  });
});
