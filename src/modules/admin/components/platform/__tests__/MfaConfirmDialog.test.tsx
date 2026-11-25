import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ status: vi.fn(), verify: vi.fn() }));

vi.mock('@/modules/auth/services/mfaService', () => ({
  mfaService: { status: mocks.status, verify: mocks.verify },
}));

import { MfaConfirmDialog } from '../MfaConfirmDialog';

// O campo do código (input-otp) deixa temporizadores que disparavam depois de o jsdom fechar
// ("window is not defined", erro não tratado no fim do ficheiro). Guardam-se e cancelam-se no fim.
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const realSetTimeout = globalThis.setTimeout;

beforeAll(() => {
  globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const id = realSetTimeout(
      (...a: unknown[]) => {
        pendingTimers.delete(id);
        if (typeof handler === 'function') handler(...a);
      },
      delay,
      ...args
    );
    pendingTimers.add(id);
    return id;
  }) as typeof setTimeout;
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

afterAll(() => {
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers.clear();
  globalThis.setTimeout = realSetTimeout;
});

const renderDialog = (open = true) => {
  const onDone = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <MfaConfirmDialog open={open} onDone={onDone} />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { onDone, ...view };
};

const typeCode = async (code: string) => {
  await userEvent.type(await screen.findByLabelText('Código de 6 dígitos'), code);
};

describe('MfaConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status.mockResolvedValue({ active: { id: 'factor-1' } });
    mocks.verify.mockResolvedValue(undefined);
  });

  it('fechado não pergunta nada ao servidor nem mostra o diálogo', () => {
    renderDialog(false);
    expect(mocks.status).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aberto pede o código de 6 dígitos da aplicação de autenticação', async () => {
    renderDialog();
    expect(await screen.findByText('Confirme com o autenticador')).toBeInTheDocument();
    expect(
      screen.getByText('Introduza o código de 6 dígitos da aplicação de autenticação.')
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Código de 6 dígitos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('um código certo é verificado contra o segundo passo ativo e termina com onDone(true)', async () => {
    const { onDone } = renderDialog();
    await typeCode('123456');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledWith('factor-1', '123456');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('um código errado mostra a mensagem em português e não termina', async () => {
    mocks.verify.mockRejectedValue({ code: 'mfa_verification_failed' });
    const { onDone } = renderDialog();
    await typeCode('000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Código inválido. Confirme os 6 dígitos que a app mostra agora e tente outra vez.'
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('um erro desconhecido nunca mostra o texto técnico do servidor', async () => {
    mocks.verify.mockRejectedValue(new Error('pg: connection reset'));
    renderDialog();
    await typeCode('111111');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Não foi possível concluir. Verifique a ligação e tente outra vez.'
    );
    expect(alert).not.toHaveTextContent('pg:');
  });

  it('Escape é desistir: onDone(false), sem verificar nada', async () => {
    const { onDone } = renderDialog();
    await screen.findByLabelText('Código de 6 dígitos');
    await userEvent.keyboard('{Escape}');
    expect(onDone).toHaveBeenCalledWith(false);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('sem segundo passo na conta explica como o ativar e não mostra o campo do código', async () => {
    mocks.status.mockResolvedValue({ active: null });
    renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta conta ainda não tem o segundo passo.'
    );
    expect(screen.getByRole('link', { name: 'Definições' })).toHaveAttribute(
      'href',
      '/colaborador/definicoes'
    );
    expect(screen.queryByLabelText('Código de 6 dígitos')).not.toBeInTheDocument();
  });

  it('seguir o link para as Definições conta como desistir (onDone(false))', async () => {
    mocks.status.mockResolvedValue({ active: null });
    const { onDone } = renderDialog();
    await userEvent.click(await screen.findByRole('link', { name: 'Definições' }));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('se não dá para saber o estado do segundo passo avisa e deixa tentar outra vez', async () => {
    mocks.status.mockRejectedValueOnce(new Error('rede'));
    renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar o segundo passo.'
    );
    expect(screen.queryByLabelText('Código de 6 dígitos')).not.toBeInTheDocument();
    expect(screen.queryByText(/ainda não tem o segundo passo/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByLabelText('Código de 6 dígitos')).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledTimes(2);
  });
});
