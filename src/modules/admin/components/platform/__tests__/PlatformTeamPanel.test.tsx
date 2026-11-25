import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../../lib/sharing';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  list: vi.fn(),
  candidates: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  reauthenticate: vi.fn(),
  levels: vi.fn(),
  mfaStatus: vi.fn(),
  mfaVerify: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../services/superAdminService', () => ({
  superAdminService: {
    list: mocks.list,
    candidates: mocks.candidates,
    add: mocks.add,
    remove: mocks.remove,
  },
}));
vi.mock('../../../services/sharingService', () => ({
  sharingService: { reauthenticate: mocks.reauthenticate },
}));
vi.mock('@/modules/auth/services/mfaService', () => ({
  mfaService: { levels: mocks.levels, status: mocks.mfaStatus, verify: mocks.mfaVerify },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'ana@realize.pt' } }),
}));

import { PlatformTeamPanel } from '../PlatformTeamPanel';

// Os diálogos Radix com userEvent demoram: em máquinas carregadas 5 s não chegam
vi.setConfig({ testTimeout: 15_000 });

const ANA = {
  user_id: 'u1',
  name: 'Ana Silva',
  email: 'ana@realize.pt',
  since: '2025-01-10T12:00:00Z',
  mfa_enabled: true,
  added_by_name: null,
  is_self: true,
};
const RUI = {
  user_id: 'u2',
  name: 'Rui Costa',
  email: 'rui@realize.pt',
  since: '2025-03-05T12:00:00Z',
  mfa_enabled: false,
  added_by_name: 'Ana Silva',
  is_self: false,
};
const CANDIDATE = {
  user_id: 'u9',
  name: 'Sara Dias',
  email: 'sara@beta.pt',
  companies: 'Beta Lda',
  mfa_enabled: true,
};
const CANDIDATE_NO_MFA = {
  user_id: 'u8',
  name: 'Tiago Reis',
  email: 'tiago@beta.pt',
  companies: 'Gama Lda',
  mfa_enabled: false,
};

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  // O campo do código (input-otp) usa estas duas coisas, que o jsdom não tem.
  document.elementFromPoint ??= () => null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

const CODE_DIALOG = 'Confirme com o autenticador';
const PASSWORD_DIALOG = 'Confirme a sua palavra-passe';
const NEEDS_CODE = { currentLevel: 'aal1', nextLevel: 'aal2' };

const typePassword = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText('Palavra-passe'), 'segredo-certo');
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
};

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <PlatformTeamPanel />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { client, invalidate, ...view };
};

const row = (name: string) => {
  const item = screen.getByText(name, { selector: 'p' }).closest('li');
  if (!item) throw new Error(`Sem linha para ${name}`);
  return within(item);
};

const confirmRemoval = async (user: ReturnType<typeof userEvent.setup>, who = 'Rui Costa') => {
  await user.click(await screen.findByRole('button', { name: `Retirar ${who}` }));
  return screen.findByRole('alertdialog');
};

describe('PlatformTeamPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([ANA, RUI]);
    mocks.candidates.mockResolvedValue([CANDIDATE, CANDIDATE_NO_MFA]);
    mocks.add.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.reauthenticate.mockResolvedValue(undefined);
    // Por omissão a conta não tem segundo passo obrigatório (nunca vai à rede)
    mocks.levels.mockResolvedValue({ currentLevel: 'aal1', nextLevel: 'aal1' });
    mocks.mfaStatus.mockResolvedValue({ active: { id: 'factor-1' } });
    mocks.mfaVerify.mockResolvedValue(undefined);
  });

  describe('lista', () => {
    it('mostra o título e a explicação', async () => {
      renderPanel();
      expect(
        await screen.findByRole('heading', { name: 'Super administradores' })
      ).toBeInTheDocument();
      expect(screen.getByText(/Veem e gerem todas as empresas/)).toBeInTheDocument();
      expect(screen.getByText(/O segundo passo \(autenticador\) é opcional\./)).toBeInTheDocument();
    });

    it('mostra nome, email, desde quando e quem adicionou', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      expect(screen.getByText('rui@realize.pt')).toBeInTheDocument();
      expect(screen.getByText(/Desde 5 de março de 2025, adicionado por Ana Silva/)).toBeVisible();
      expect(screen.getByText('ana@realize.pt')).toBeInTheDocument();
      expect(screen.getByText(/^Desde 10 de janeiro de 2025$/)).toBeVisible();
    });

    it('mostra se o segundo passo está ativo ou desativado, por pessoa, sem o tratar como falta', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      expect(row('Ana Silva').getByText('Segundo passo: ativo')).toBeInTheDocument();
      expect(row('Rui Costa').getByText('Segundo passo: desativado')).toBeInTheDocument();
      expect(screen.queryByText('Sem segundo passo')).not.toBeInTheDocument();
    });

    it('o selo do segundo passo é neutro (cinzento) e sem ícone, esteja ativo ou não', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      for (const [who, text] of [
        ['Ana Silva', 'Segundo passo: ativo'],
        ['Rui Costa', 'Segundo passo: desativado'],
      ] as const) {
        const badge = row(who).getByText(text);
        expect(badge).toHaveClass('text-muted-foreground');
        expect(badge.className).not.toMatch(/destructive|red|amber|yellow|green|emerald/);
        expect(badge.querySelector('svg')).toBeNull();
      }
    });

    it('mostra as iniciais de cada pessoa', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      expect(row('Ana Silva').getByText('AS')).toBeInTheDocument();
      expect(row('Rui Costa').getByText('RC')).toBeInTheDocument();
    });

    it('marca o próprio com "(você)" e só a ele', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      expect(row('Ana Silva').getByText('(você)')).toBeInTheDocument();
      expect(row('Rui Costa').queryByText('(você)')).not.toBeInTheDocument();
    });

    it('Retirar fica desativado para o próprio, com a razão, e ativo para os outros', async () => {
      renderPanel();
      const own = await screen.findByRole('button', { name: 'Retirar Ana Silva' });
      expect(own).toBeDisabled();
      expect(own).toHaveAttribute(
        'title',
        'Peça a outro super administrador para retirar o seu acesso.'
      );
      const other = screen.getByRole('button', { name: 'Retirar Rui Costa' });
      expect(other).toBeEnabled();
      expect(other).not.toHaveAttribute('title');
    });

    it('o próprio não consegue abrir a confirmação de retirada', async () => {
      renderPanel();
      await userEvent.click(await screen.findByRole('button', { name: 'Retirar Ana Silva' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('estados', () => {
    it('enquanto carrega mostra o estado A carregar', () => {
      mocks.list.mockReturnValue(new Promise(() => {}));
      renderPanel();
      expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
    });

    it('lista vazia mostra a mensagem de vazio, sem linhas', async () => {
      mocks.list.mockResolvedValue([]);
      renderPanel();
      expect(await screen.findByText('Sem super administradores')).toBeInTheDocument();
      expect(screen.getByText('Não devia acontecer: contacte o suporte.')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('com erro mostra o texto em português e Tentar outra vez volta a ler', async () => {
      mocks.list.mockRejectedValueOnce(new SharingError('not_platform_admin'));
      renderPanel();
      expect(await screen.findByText('Não foi possível carregar')).toBeInTheDocument();
      expect(screen.getByText(/Esta ação é só para a administração da plataforma/)).toBeVisible();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
      expect(await screen.findByText('Rui Costa')).toBeInTheDocument();
      expect(mocks.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('retirar', () => {
    it('a confirmação diz quem perde o acesso e Cancelar não chama o serviço', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      expect(dialog).toHaveTextContent('Retirar super administrador');
      expect(dialog).toHaveTextContent('Rui Costa deixa de ver todas as empresas.');
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('confirmar chama remove com o id, dá o aviso, relê a lista e fecha', async () => {
      const user = userEvent.setup();
      const { invalidate } = renderPanel();
      const dialog = await confirmRemoval(user);
      mocks.list.mockResolvedValue([ANA]);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));

      await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('u2'));
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByText('Rui Costa')).not.toBeInTheDocument());
      expect(screen.getByText('Ana Silva')).toBeInTheDocument();
      expect(invalidate).toHaveBeenCalled();
    });

    it('se o servidor recusa (último super admin) mostra o erro e mantém a pessoa', async () => {
      mocks.remove.mockRejectedValue(new SharingError('last_super_admin'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível concluir',
          description: 'A plataforma tem de ter pelo menos um super administrador.',
          variant: 'destructive',
        })
      );
      expect(screen.getByText('Rui Costa', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('retirar funciona sem nenhum diálogo de código nem de palavra-passe', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));

      await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('u2'));
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' }));
      expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
      expect(mocks.reauthenticate).not.toHaveBeenCalled();
      expect(mocks.levels).not.toHaveBeenCalled();
      expect(mocks.remove).toHaveBeenCalledTimes(1);
    });

    it('sem segundo passo: palavra-passe confirmada repete a retirada logo, sem diálogo do código', async () => {
      mocks.remove.mockRejectedValueOnce(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));

      expect(await screen.findByRole('dialog', { name: PASSWORD_DIALOG })).toBeInTheDocument();
      expect(screen.getByText(/exige um início de sessão recente/)).toBeInTheDocument();
      expect(mocks.remove).toHaveBeenCalledTimes(1);

      await typePassword(user);
      await waitFor(() =>
        expect(mocks.reauthenticate).toHaveBeenCalledWith('ana@realize.pt', 'segredo-certo')
      );
      await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
      expect(mocks.remove).toHaveBeenLastCalledWith('u2');
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument()
      );
      expect(mocks.levels).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
      expect(mocks.mfaStatus).not.toHaveBeenCalled();
      expect(mocks.mfaVerify).not.toHaveBeenCalled();
    });

    it('se levels() não responde (null) repete logo, sem diálogo do código', async () => {
      mocks.levels.mockResolvedValue(null);
      mocks.remove.mockRejectedValueOnce(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));
      await typePassword(user);

      await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' }));
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
    });

    it('com segundo passo obrigatório (aal1 -> aal2): palavra-passe, depois código, e só então repete a retirada', async () => {
      mocks.levels.mockResolvedValue(NEEDS_CODE);
      mocks.remove.mockRejectedValueOnce(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));
      await typePassword(user);

      const code = await screen.findByRole('dialog', { name: CODE_DIALOG });
      expect(code).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument();
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.toast).not.toHaveBeenCalled();

      await userEvent.type(await within(code).findByLabelText('Código de 6 dígitos'), '123456');
      await waitFor(() => expect(mocks.mfaVerify).toHaveBeenCalledWith('factor-1', '123456'));
      await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
      expect(mocks.remove).toHaveBeenLastCalledWith('u2');
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Acesso retirado' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument()
      );
    });

    it('desistir do código (Escape) não repete a retirada nem mostra erro', async () => {
      mocks.levels.mockResolvedValue(NEEDS_CODE);
      mocks.remove.mockRejectedValue(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));
      await typePassword(user);
      await screen.findByRole('dialog', { name: CODE_DIALOG });

      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument()
      );
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.mfaVerify).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it('desistir da palavra-passe (Cancelar) não repete a retirada nem mostra erro', async () => {
      mocks.remove.mockRejectedValue(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));
      const reauth = await screen.findByRole('dialog', { name: PASSWORD_DIALOG });

      await user.click(within(reauth).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument()
      );
      expect(mocks.remove).toHaveBeenCalledTimes(1);
      expect(mocks.reauthenticate).not.toHaveBeenCalled();
      expect(mocks.levels).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it('se depois da palavra-passe a base volta a recusar mostra o toast da sessão antiga e não pede outra vez', async () => {
      mocks.remove.mockRejectedValue(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await confirmRemoval(user);
      await user.click(within(dialog).getByRole('button', { name: 'Retirar acesso' }));
      await typePassword(user);

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível concluir',
          description: 'A sua sessão está demasiado antiga. Saia e entre outra vez.',
          variant: 'destructive',
        })
      );
      expect(mocks.toast).toHaveBeenCalledTimes(1);
      expect(mocks.remove).toHaveBeenCalledTimes(2);
      expect(mocks.reauthenticate).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
    });
  });

  describe('adicionar', () => {
    const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: /^Adicionar$/ }));
      return screen.findByRole('dialog', { name: 'Adicionar super administrador' });
    };

    const choose = async (
      user: ReturnType<typeof userEvent.setup>,
      dialog: HTMLElement,
      name = 'Sara Dias'
    ) => {
      await user.click(await within(dialog).findByRole('combobox', { name: 'Pessoa' }));
      await user.click(await screen.findByRole('option', { name: new RegExp(name) }));
    };

    it('o botão Adicionar do painel abre o diálogo com os candidatos', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await user.click(await within(dialog).findByRole('combobox', { name: 'Pessoa' }));
      expect(await screen.findByRole('option', { name: 'Sara Dias · sara@beta.pt' })).toBeVisible();
      expect(mocks.candidates).toHaveBeenCalled();
    });

    it('não lê os candidatos antes de abrir o diálogo', async () => {
      renderPanel();
      await screen.findByText('Rui Costa');
      expect(mocks.candidates).not.toHaveBeenCalled();
    });

    it('um candidato sem segundo passo deixa Adicionar ativo, sem aviso, e adiciona-o com o id certo', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await choose(user, dialog, 'Tiago Reis');
      expect(within(dialog).getByRole('combobox', { name: 'Pessoa' })).toHaveTextContent(
        'Tiago Reis'
      );
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).queryByText(/segundo passo/i)).not.toBeInTheDocument();
      const confirm = within(dialog).getByRole('button', { name: 'Adicionar' });
      expect(confirm).toBeEnabled();
      expect(mocks.add).not.toHaveBeenCalled();

      await user.click(confirm);
      await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('u8'));
      expect(mocks.add).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({ title: 'Super administrador adicionado' })
      );
      expect(screen.queryByRole('dialog', { name: PASSWORD_DIALOG })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
      expect(mocks.reauthenticate).not.toHaveBeenCalled();
      expect(mocks.levels).not.toHaveBeenCalled();
    });

    it('confirmar chama add com o id, dá o aviso, relê a lista e fecha o diálogo', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await choose(user, dialog);
      mocks.list.mockResolvedValue([
        ANA,
        RUI,
        { ...CANDIDATE, since: '2025-06-01T12:00:00Z', is_self: false, added_by_name: 'Ana Silva' },
      ]);
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

      await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('u9'));
      expect(mocks.add).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({ title: 'Super administrador adicionado' })
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Adicionar super administrador' })
        ).not.toBeInTheDocument()
      );
      expect(await screen.findByText('Sara Dias', { selector: 'p' })).toBeInTheDocument();
    });

    it('se a adição falha mostra o erro e mantém o diálogo aberto', async () => {
      mocks.add.mockRejectedValue(new SharingError('already_super_admin'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await choose(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: 'Não foi possível concluir',
          description: 'Esta pessoa já é super administradora.',
          variant: 'destructive',
        })
      );
      expect(
        screen.getByRole('dialog', { name: 'Adicionar super administrador' })
      ).toBeInTheDocument();
    });

    it('com reauth_required pede a palavra-passe e, confirmada, repete a adição uma vez', async () => {
      mocks.add.mockRejectedValueOnce(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await choose(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

      await screen.findByRole('dialog', { name: PASSWORD_DIALOG });
      await typePassword(user);
      await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
      expect(mocks.add).toHaveBeenLastCalledWith('u9');
      expect(mocks.reauthenticate).toHaveBeenCalledWith('ana@realize.pt', 'segredo-certo');
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({ title: 'Super administrador adicionado' })
      );
      expect(screen.queryByRole('dialog', { name: CODE_DIALOG })).not.toBeInTheDocument();
    });

    it('com segundo passo obrigatório (aal1 -> aal2) a adição só repete depois do código', async () => {
      mocks.levels.mockResolvedValue(NEEDS_CODE);
      mocks.add.mockRejectedValueOnce(new SharingError('reauth_required'));
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await choose(user, dialog);
      await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

      await screen.findByRole('dialog', { name: PASSWORD_DIALOG });
      await typePassword(user);
      const code = await screen.findByRole('dialog', { name: CODE_DIALOG });
      expect(mocks.add).toHaveBeenCalledTimes(1);

      await userEvent.type(await within(code).findByLabelText('Código de 6 dígitos'), '654321');
      await waitFor(() => expect(mocks.mfaVerify).toHaveBeenCalledWith('factor-1', '654321'));
      await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
      expect(mocks.add).toHaveBeenLastCalledWith('u9');
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({ title: 'Super administrador adicionado' })
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Adicionar super administrador' })
        ).not.toBeInTheDocument()
      );
    });

    it('Cancelar fecha o diálogo sem adicionar', async () => {
      const user = userEvent.setup();
      renderPanel();
      const dialog = await openAdd(user);
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Adicionar super administrador' })
        ).not.toBeInTheDocument()
      );
      expect(mocks.add).not.toHaveBeenCalled();
    });
  });
});
