import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// WebmailPage com várias mensagens abertas. As peças pesadas (lista, leitor, diálogos, dados) são
// simuladas; a lógica das mensagens abertas (abrir, restaurar, fechar, limite, anular, sessão) e o
// MailComposer são os reais.
const h = vi.hoisted(() => {
  /** Objeto que aceita qualquer leitura ou chamada (hooks de dados que aqui não interessam). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados simulados que aceitam tudo
  const deep = (overrides: Record<string, unknown> = {}): any =>
    new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop in overrides) return overrides[prop as string];
        if (prop === 'then' || prop === Symbol.toPrimitive || prop === Symbol.iterator)
          return undefined;
        if (prop === 'length' || prop === 'size') return 0;
        if (
          [
            'messages',
            'accounts',
            'labels',
            'list',
            'items',
            'folders',
            'contacts',
            'lists',
          ].includes(String(prop))
        )
          return [];
        if (
          ['isLoading', 'loading', 'isFetching', 'hasMore', 'busy', 'truncated'].includes(
            String(prop)
          )
        )
          return false;
        return deep();
      },
      apply: () => deep(),
    });
  const account = {
    id: 'acc',
    provider: 'imap',
    authMethod: 'imap',
    email: 'marketing@exemplo.pt',
    displayName: null,
    label: null,
    signatures: [],
    status: 'active',
    lastError: null,
    lastSyncAt: null,
    isDefault: true,
    color: 'blue',
  };
  return { deep, account, toast: vi.fn(), send: vi.fn(), compose: { current: () => {} } };
});

vi.mock('@/hooks/use-toast', () => ({ toast: h.toast, useToast: () => ({ toast: h.toast }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false, posto: null, mailOnly: true }),
}));
vi.mock('@/modules/social/hooks/useDirectory', () => ({
  useDirectory: () => ({ colleagues: [] }),
}));
vi.mock('../../hooks/useDraftSaver', () => ({
  useDraftSaver: () => ({
    status: 'idle',
    savedAt: null,
    current: () => null,
    flush: async () => true,
    save: async () => true,
    isDirty: () => false,
    stop: () => {},
    settled: async () => {},
    discard: async () => {},
  }),
}));
vi.mock('../../hooks/useMailAccounts', () => ({
  useMailAccounts: () =>
    h.deep({ accounts: [h.account], isLoading: false, refresh: async () => {} }),
}));
vi.mock('../../hooks/useMailActions', () => ({
  useMailActions: () => h.deep({ send: h.send, toBase64: async () => '' }),
}));
vi.mock('../../hooks/useSearchAllFolders', () => ({
  useSearchAllFolders: () => [false, () => {}],
}));
vi.mock('../../hooks/useLabelActions', () => ({ useLabelActions: () => h.deep() }));
vi.mock('../../hooks/useLabelCounts', () => ({ useLabelCounts: () => h.deep() }));
vi.mock('../../hooks/useMailLabels', () => ({ useAllMailLabels: () => h.deep() }));
vi.mock('../../hooks/useContacts', () => ({ useContacts: () => h.deep() }));
vi.mock('../../hooks/useKeptUnread', () => ({ useKeptUnread: () => h.deep() }));
vi.mock('../../hooks/useFolderActions', () => ({ useFolderActions: () => h.deep() }));
vi.mock('../../hooks/useMailFolders', () => ({ useMailFolders: () => h.deep() }));
vi.mock('../../hooks/useUnreadCounts', () => ({ useUnreadCounts: () => h.deep() }));
vi.mock('../../hooks/useMailbox', () => ({
  useMailbox: () => h.deep(),
  useMailMessage: () => h.deep({ data: undefined }),
  usePrefetchMessage: () => () => {},
  usePrefetchTop: () => {},
}));
vi.mock('../../components/ConnectMailDialog', () => ({ ConnectMailDialog: () => null }));
vi.mock('../../components/FolderManageDialogs', () => ({ FolderManageDialogs: () => null }));
vi.mock('../../components/NewMailFolderDialog', () => ({ NewMailFolderDialog: () => null }));
vi.mock('../../components/ContactListsDialog', () => ({ ContactListsDialog: () => null }));
vi.mock('../../components/AttachmentPreview', () => ({ AttachmentPreview: () => null }));
vi.mock('../../components/MailAccountDialog', () => ({ MailAccountDialog: () => null }));
vi.mock('../../components/MailRulesDialog', () => ({ MailRulesDialog: () => null }));
vi.mock('../../components/ManageLabelsDialog', () => ({ ManageLabelsDialog: () => null }));
vi.mock('../../components/MailList', () => ({ MailList: () => null }));
vi.mock('../../components/MailReader', () => ({ MailReader: () => null }));
vi.mock('../../components/SidebarResizer', () => ({ SidebarResizer: () => null }));
vi.mock('../../components/MailToTaskOrEvent', () => ({ MailToTaskOrEvent: () => null }));
vi.mock('../../components/ProviderGrid', () => ({ ProviderGrid: () => null }));
vi.mock('../../components/MailSidebar', () => ({
  // A barra lateral só expõe o «Escrever» (abre uma mensagem nova)
  MailSidebar: ({ onCompose }: { onCompose: () => void }) => {
    h.compose.current = onCompose;
    return null;
  },
}));

import WebmailPage from '../WebmailPage';
import { composeSession } from '../../lib/composeSession';
import { resetSessionMemory } from '@/lib/session-memory';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WebmailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

const write = () => act(() => h.compose.current());
const bars = () =>
  screen
    .queryAllByRole('button', { name: 'Abrir a mensagem', hidden: true })
    .map(b => b.closest('div') as HTMLElement);
const dialogs = () => screen.queryAllByRole('dialog');

beforeEach(() => {
  resetSessionMemory();
  h.toast.mockClear();
  h.send.mockReset();
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
});
afterEach(() => resetSessionMemory());

describe('Webmail: várias mensagens abertas', () => {
  it('abrir 3: uma grande e duas barras lado a lado, sem sobreposição', async () => {
    renderPage();
    await write();
    await write();
    await write();
    expect(dialogs()).toHaveLength(1);
    const rights = bars().map(b => b.style.right);
    expect(rights).toHaveLength(2);
    expect(new Set(rights).size).toBe(2);
    expect(rights.sort()).toEqual(['16px', '348px']);
  });

  it('restaurar outra: essa fica grande e a que estava grande passa a barra', async () => {
    renderPage();
    await write();
    await write();
    expect(bars()).toHaveLength(1);
    await act(async () => bars()[0].querySelector('button')!.click());
    expect(dialogs()).toHaveLength(1);
    expect(bars()).toHaveLength(1);
  });

  it('fechar uma barra: sai e as outras voltam a ficar seguidas da direita', async () => {
    renderPage();
    await write();
    await write();
    await write();
    await write(); // 3 barras + 1 grande
    expect(bars().map(b => b.style.right)).toEqual(['16px', '348px', '680px']);
    const close = bars()[0].querySelector(
      'button[aria-label="Descartar a mensagem"]'
    ) as HTMLElement;
    await act(async () => close.click());
    expect(bars().map(b => b.style.right)).toEqual(['16px', '348px']);
    expect(dialogs()).toHaveLength(1);
  });

  it('limite de 5: a 6.ª não abre e aparece o aviso', async () => {
    renderPage();
    for (let i = 0; i < 6; i++) await write();
    expect(bars().length + dialogs().length).toBe(5);
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Já tem 5 mensagens abertas' })
    );
  });

  it('sair e voltar com várias a meio: voltam todas, minimizadas', async () => {
    composeSession.set('m1', { accountId: 'acc', subject: 'Proposta A', body: 'a' });
    composeSession.set('m2', { accountId: 'acc', subject: 'Proposta B', body: 'b' });
    renderPage();
    expect(dialogs()).toHaveLength(0);
    expect(bars()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Proposta A', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proposta B', hidden: true })).toBeInTheDocument();
  });

  it('troca de conta limpa as mensagens guardadas', async () => {
    composeSession.set('m1', { accountId: 'acc', subject: 'Proposta A', body: 'a' });
    resetSessionMemory();
    renderPage();
    expect(bars()).toHaveLength(0);
    expect(dialogs()).toHaveLength(0);
  });

  it('anular um envio com outras abertas: volta à frente e as outras ficam', async () => {
    h.send.mockResolvedValue('undone');
    composeSession.set('m1', { accountId: 'acc', subject: 'Proposta A', body: 'a' });
    composeSession.set('m2', {
      accountId: 'acc',
      to: 'cliente@exemplo.pt',
      subject: 'Proposta B',
      body: 'b',
    });
    renderPage();
    await act(async () => screen.getByRole('button', { name: 'Proposta B', hidden: true }).click());
    expect(dialogs()).toHaveLength(1);
    await act(async () => screen.getByRole('button', { name: /^Enviar/, hidden: true }).click());
    await act(async () => new Promise(r => setTimeout(r, 0)));
    expect(h.send).toHaveBeenCalledTimes(1);
    // A anulada volta grande; a A continua em barra
    expect(dialogs()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Proposta A', hidden: true })).toBeInTheDocument();
  });
});

describe('mensagem grande com outras abertas (não prende a página)', () => {
  it('clicar numa barra com uma grande aberta passa para essa', async () => {
    renderPage();
    await write();
    await write();
    const user = userEvent.setup();
    const bar = bars()[0].querySelector('button') as HTMLElement;
    await user.click(bar);
    expect(dialogs()).toHaveLength(1);
    expect(bars()).toHaveLength(1);
  });

  // QA 25/11: o Tab não sai da grande (FocusScope do Radix); a troca faz-se pelos botões
  // «Outras abertas» dentro dela.
  it('com Tab chega-se a «Passar para…» dentro da grande, e Enter troca de mensagem', async () => {
    composeSession.set('m1', { accountId: 'acc', subject: 'Proposta A', body: 'a' });
    renderPage();
    await write(); // a nova fica grande e a Proposta A em barra
    const nav = screen.getByRole('navigation', { name: 'Outras mensagens abertas' });
    expect(nav).toHaveTextContent('Outras abertas:');
    const target = screen.getByRole('button', { name: 'Passar para a mensagem «Proposta A»' });
    const user = userEvent.setup();
    let guard = 0;
    while (document.activeElement !== target && guard++ < 60) await user.tab();
    expect(target).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(dialogs()).toHaveLength(1);
    expect(screen.getByDisplayValue('Proposta A')).toBeInTheDocument();
    // A que estava grande passou a barra, e a lista da grande mostra-a
    expect(bars()).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Passar para a mensagem «Nova mensagem»' })
    ).toBeInTheDocument();
  });

  it('só com uma mensagem não aparece «Outras abertas»', async () => {
    renderPage();
    await write();
    expect(dialogs()).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Outras mensagens abertas' })).toBeNull();
    expect(screen.queryByText('Outras abertas:')).toBeNull();
  });

  it('clicar fora da grande não a fecha (com outras abertas)', async () => {
    renderPage();
    await write();
    await write();
    const user = userEvent.setup();
    await user.click(document.body);
    expect(dialogs()).toHaveLength(1);
    expect(bars()).toHaveLength(1);
  });

  // QA 25/11: com outras mensagens abertas, um Esc fora da grande não a fecha.
  it('Esc com o foco numa barra (fora da grande) não fecha a grande', async () => {
    renderPage();
    await write();
    await write();
    const bar = bars()[0].querySelector('button') as HTMLElement;
    bar.focus();
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(dialogs()).toHaveLength(1);
    expect(bars()).toHaveLength(1);
  });
});

describe('só uma mensagem: continua como antes (modal)', () => {
  it('o foco fica preso na grande e Esc fecha-a', async () => {
    renderPage();
    await write();
    const dialog = dialogs()[0];
    const user = userEvent.setup();
    for (let i = 0; i < 40; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    expect(dialogs()).toHaveLength(0);
  });

  it('clicar fora não a fecha', async () => {
    renderPage();
    await write();
    const overlay = document.querySelector(
      '[data-state="open"].fixed.inset-0'
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull(); // a camada do modal continua
    await act(async () => {
      overlay!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      overlay!.click();
    });
    expect(dialogs()).toHaveLength(1);
  });
});
