import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../../lib/sharing';

const candidates = vi.fn();
vi.mock('../../../services/superAdminService', () => ({
  superAdminService: { candidates: (...args: unknown[]) => candidates(...args) },
}));

import { AddPlatformAdminDialog } from '../AddPlatformAdminDialog';

const WITH_MFA = {
  user_id: 'u2',
  name: 'Rui Costa',
  email: 'rui@acme.pt',
  companies: 'Acme Lda',
  mfa_enabled: true,
};
const WITHOUT_MFA = {
  user_id: 'u3',
  name: 'Sara Dias',
  email: 'sara@beta.pt',
  companies: 'Beta Lda, Gama Lda',
  mfa_enabled: false,
};

// O jsdom não tem o que o Radix Select usa para abrir a lista.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

type Props = React.ComponentProps<typeof AddPlatformAdminDialog>;

const renderDialog = (props: Partial<Props> = {}) => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AddPlatformAdminDialog
        open
        busy={false}
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />
    </QueryClientProvider>
  );
  return { onClose, onConfirm, ...view };
};

const pick = async (name: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Pessoa' }));
  await user.click(await screen.findByRole('option', { name: new RegExp(name) }));
};

describe('AddPlatformAdminDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    candidates.mockResolvedValue([WITH_MFA, WITHOUT_MFA]);
  });

  it('fechado não lê os candidatos nem mostra nada', () => {
    renderDialog({ open: false });
    expect(candidates).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aberto lê os candidatos e mostra o título e a explicação', async () => {
    renderDialog();
    expect(
      await screen.findByRole('heading', { name: 'Adicionar super administrador' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Passa a ver e a gerir todas as empresas/)).toBeInTheDocument();
    await waitFor(() => expect(candidates).toHaveBeenCalledTimes(1));
  });

  it('lista os candidatos com nome e email', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('combobox', { name: 'Pessoa' }));
    expect(await screen.findByRole('option', { name: 'Rui Costa · rui@acme.pt' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Sara Dias · sara@beta.pt' })).toBeVisible();
  });

  it('Adicionar começa desativado, até se escolher alguém', async () => {
    renderDialog();
    await screen.findByRole('combobox', { name: 'Pessoa' });
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('escolher alguém com segundo passo mostra as empresas e nenhum aviso', async () => {
    renderDialog();
    await pick('Rui Costa');
    expect(screen.getByText('Administra Acme Lda.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled();
  });

  it('escolher alguém sem segundo passo mostra o aviso e não deixa adicioná-lo', async () => {
    const { onConfirm } = renderDialog();
    await pick('Sara Dias');
    expect(screen.getByText('Administra Beta Lda, Gama Lda.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ainda não ativou o segundo passo. Peça-lhe para o ativar nas Definições e tente depois.'
    );
    const add = screen.getByRole('button', { name: 'Adicionar' });
    expect(add).toBeDisabled();
    await userEvent.click(add);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('trocar para alguém com segundo passo tira o aviso e ativa Adicionar', async () => {
    renderDialog();
    await pick('Sara Dias');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await pick('Rui Costa');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled();
  });

  it('Adicionar chama onConfirm com o id escolhido', async () => {
    const { onConfirm } = renderDialog();
    await pick('Rui Costa');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('u2');
  });

  it('ao fechar e reabrir não fica a escolha anterior', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (open: boolean) => (
      <QueryClientProvider client={client}>
        <AddPlatformAdminDialog open={open} busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    await pick('Rui Costa');
    expect(screen.getByText('Administra Acme Lda.')).toBeInTheDocument();

    rerender(tree(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    rerender(tree(true));
    await screen.findByRole('combobox', { name: 'Pessoa' });
    expect(screen.queryByText('Administra Acme Lda.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('Cancelar chama onClose', async () => {
    const { onClose } = renderDialog();
    await screen.findByRole('combobox', { name: 'Pessoa' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('com a ação a correr (busy) os botões ficam desativados e Escape não fecha', async () => {
    const { onClose } = renderDialog({ busy: true });
    await screen.findByRole('combobox', { name: 'Pessoa' });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sem busy, Escape fecha o diálogo', async () => {
    const { onClose } = renderDialog();
    await screen.findByRole('combobox', { name: 'Pessoa' });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('estados da lista', () => {
    it('enquanto carrega mostra o estado A carregar', () => {
      candidates.mockReturnValue(new Promise(() => {}));
      renderDialog();
      expect(screen.getByRole('status', { name: 'A carregar' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('sem candidatos explica porquê e não mostra o seletor', async () => {
      candidates.mockResolvedValue([]);
      renderDialog();
      expect(await screen.findByText('Não há ninguém para adicionar')).toBeInTheDocument();
      expect(
        screen.getByText('Só se pode promover quem já administra uma empresa.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    });

    it('com erro mostra o texto em português e deixa tentar outra vez', async () => {
      candidates.mockRejectedValueOnce(new SharingError('not_platform_admin'));
      renderDialog();
      expect(await screen.findByText('Não foi possível carregar')).toBeInTheDocument();
      expect(
        screen.getByText(/Esta ação é só para a administração da plataforma/)
      ).toBeInTheDocument();

      candidates.mockResolvedValueOnce([WITH_MFA]);
      await userEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
      expect(await screen.findByRole('combobox', { name: 'Pessoa' })).toBeInTheDocument();
      expect(candidates).toHaveBeenCalledTimes(2);
    });
  });
});
