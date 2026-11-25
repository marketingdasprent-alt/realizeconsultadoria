import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Várias mensagens abertas ao mesmo tempo (compositor, sessão e IA). Tudo simulado.
const { rewriteText } = vi.hoisted(() => ({ rewriteText: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));
vi.mock('@/modules/social/hooks/useDirectory', () => ({
  useDirectory: () => ({ colleagues: [] }),
}));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ mailOnly: true }),
}));
vi.mock('../../hooks/useDraftSaver', () => ({
  useDraftSaver: () => ({
    status: 'idle',
    savedAt: null,
    current: () => null,
    flush: vi.fn(async () => true),
    save: vi.fn(),
    isDirty: () => false,
    stop: vi.fn(),
    settled: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
  }),
}));
vi.mock('@/modules/ai/services/aiService', () => ({
  rewriteText,
  AiError: class extends Error {},
}));

import { MailComposer } from '../MailComposer';
import { composeSession } from '../../lib/composeSession';
import { useAiRewrite } from '../../hooks/useAiRewrite';
import { resetSessionMemory } from '@/lib/session-memory';

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
} as never;

const composer = (
  subject: string,
  opts: {
    minimized: boolean;
    dockIndex?: number;
    onRestore?: () => void;
    onMinimize?: () => void;
    /** Como a WebmailPage passa quando há mais de uma mensagem aberta. */
    othersOpen?: boolean;
  }
) => (
  <MailComposer
    key={subject}
    sessionKey={`k-${subject}`}
    draft={{ accountId: 'acc', subject }}
    accounts={[account]}
    onClose={vi.fn()}
    minimized={opts.minimized}
    dockIndex={opts.dockIndex ?? 0}
    othersOpen={opts.othersOpen ?? false}
    onRestore={opts.onRestore ?? vi.fn()}
    onMinimize={opts.onMinimize ?? vi.fn()}
    onSend={vi.fn(async () => true)}
    toBase64={vi.fn(async () => '')}
  />
);

const barOf = (subject: string) =>
  screen.getByRole('button', { name: subject }).parentElement as HTMLElement;

beforeEach(() => {
  composeSession.all().forEach(([key]) => composeSession.set(key, null));
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
});
afterEach(() => vi.clearAllMocks());

describe('barras das mensagens minimizadas', () => {
  it('lado a lado em baixo, sem se sobreporem (right 16 + índice × 332)', () => {
    render(
      <>
        {composer('Proposta A', { minimized: true, dockIndex: 0 })}
        {composer('Proposta B', { minimized: true, dockIndex: 1 })}
        {composer('Proposta C', { minimized: true, dockIndex: 2 })}
      </>
    );
    const rights = ['Proposta A', 'Proposta B', 'Proposta C'].map(s => barOf(s).style.right);
    expect(rights).toEqual(['16px', '348px', '680px']);
    ['Proposta A', 'Proposta B', 'Proposta C'].forEach(s =>
      expect(barOf(s).style.bottom).toBe('0px')
    );
  });

  it('abaixo de 720 px: umas por cima das outras (48 px cada)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    render(
      <>
        {composer('Proposta A', { minimized: true, dockIndex: 0 })}
        {composer('Proposta B', { minimized: true, dockIndex: 1 })}
      </>
    );
    expect([barOf('Proposta A').style.bottom, barOf('Proposta B').style.bottom]).toEqual([
      '0px',
      '48px',
    ]);
    expect(barOf('Proposta B').style.right).toBe('16px');
  });

  it('teclado: Tab chega às barras e Enter abre a mensagem', async () => {
    const restoreB = vi.fn();
    render(
      <>
        {composer('Proposta A', { minimized: true, dockIndex: 0 })}
        {composer('Proposta B', { minimized: true, dockIndex: 1, onRestore: restoreB })}
      </>
    );
    const user = userEvent.setup();
    let guard = 0;
    while (
      document.activeElement !== screen.getByRole('button', { name: 'Proposta B' }) &&
      guard++ < 10
    )
      await user.tab();
    expect(screen.getByRole('button', { name: 'Proposta B' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(restoreB).toHaveBeenCalledTimes(1);
  });

  // QA 25/11: com outras mensagens abertas, a grande não pode prender a página (Gmail).
  it('com uma mensagem grande aberta, a barra de outra continua clicável (como no Gmail)', async () => {
    const restoreB = vi.fn();
    render(
      <>
        {composer('Proposta A', { minimized: false, othersOpen: true })}
        {composer('Proposta B', {
          minimized: true,
          dockIndex: 0,
          onRestore: restoreB,
          othersOpen: true,
        })}
      </>
    );
    // A grande abre como diálogo; a barra da outra fica em baixo
    await screen.findByRole('dialog');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Proposta B', hidden: true }));
    expect(restoreB).toHaveBeenCalledTimes(1);
  });
});

describe('sessão com várias mensagens', () => {
  it('guarda por chave e pela ordem; a troca de conta limpa tudo', () => {
    composeSession.set('m1', { accountId: 'acc', subject: 'A', body: 'texto A' });
    composeSession.set('m2', { accountId: 'acc', subject: 'B', body: 'texto B' });
    expect(composeSession.all().map(([k]) => k)).toEqual(['m1', 'm2']);
    expect(composeSession.get('m2')?.body).toBe('texto B');
    composeSession.set('m1', null);
    expect(composeSession.all().map(([k]) => k)).toEqual(['m2']);
    resetSessionMemory();
    expect(composeSession.all()).toEqual([]);
  });

  it('cada compositor escreve só na sua chave', async () => {
    render(
      <>
        {composer('Proposta A', { minimized: true, dockIndex: 0 })}
        {composer('Proposta B', { minimized: true, dockIndex: 1 })}
      </>
    );
    // Só com conteúdo (assunto) é que se guardam
    await act(async () => {});
    const keys = composeSession.all().map(([k]) => k);
    expect(keys).toEqual(expect.arrayContaining(['k-Proposta A', 'k-Proposta B']));
    expect(composeSession.get('k-Proposta A')?.subject).toBe('Proposta A');
    expect(composeSession.get('k-Proposta B')?.subject).toBe('Proposta B');
  });
});

describe('IA com a página saída', () => {
  it('grava o resultado na mensagem certa (e não noutra aberta)', async () => {
    composeSession.set('m1', { accountId: 'acc', subject: 'A', body: 'texto A' });
    composeSession.set('m2', { accountId: 'acc', subject: 'B', body: 'texto B' });
    let resolve!: (v: { text: string; subject: string }) => void;
    rewriteText.mockReturnValue(new Promise(r => (resolve = r)));
    const { result, unmount } = renderHook(() => useAiRewrite(vi.fn(), 'm2'));
    let run!: Promise<void>;
    act(
      () =>
        void (run = result.current.run('improve' as never, { text: 'texto B', subject: 'B' }, ''))
    );
    unmount(); // saiu do Email
    await act(async () => {
      resolve({ text: 'texto B melhorado', subject: 'B' });
      await run;
    });
    expect(composeSession.get('m2')?.body).toBe('texto B melhorado');
    expect(composeSession.get('m1')?.body).toBe('texto A');
  });

  it('sem chave (assistente dos comunicados) não grava na sessão do Email', async () => {
    composeSession.set('mensagem', { accountId: 'acc', subject: 'X', body: 'texto' });
    rewriteText.mockResolvedValue({ text: 'outro', subject: 'X' });
    const { result, unmount } = renderHook(() => useAiRewrite(vi.fn()));
    let run!: Promise<void>;
    act(
      () => void (run = result.current.run('improve' as never, { text: 'texto', subject: 'X' }, ''))
    );
    unmount();
    await act(async () => void (await run));
    expect(composeSession.get('mensagem')?.body).toBe('texto');
  });
});
