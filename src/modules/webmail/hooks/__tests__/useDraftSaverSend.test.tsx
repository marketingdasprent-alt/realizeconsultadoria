import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Rascunhos que ficavam depois de enviar (corrida entre a gravação automática e o Enviar).
const { saveDraft, deleteDraft } = vi.hoisted(() => ({ saveDraft: vi.fn(), deleteDraft: vi.fn() }));
vi.mock('../../services/mailService', () => ({ mailService: { saveDraft, deleteDraft } }));
vi.mock('../../services/draftMetaService', () => ({
  draftMetaService: { save: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => {}) },
}));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false }),
}));

import { useDraftSaver } from '../useDraftSaver';

/** A caixa simulada: guarda o novo e apaga o anterior (como o servidor IMAP). */
let mailbox: Set<string>;
let nextUid: number;
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
};
let gates: ReturnType<typeof deferred>[];

beforeEach(() => {
  mailbox = new Set();
  nextUid = 68;
  gates = [];
  saveDraft
    .mockReset()
    .mockImplementation(async (_input: unknown, _html: string, previous: string | null) => {
      const gate = deferred();
      gates.push(gate);
      await gate.promise;
      const id = `INBOX.Drafts:${nextUid++}`;
      mailbox.add(id);
      if (previous) mailbox.delete(previous);
      return { data: { id }, error: null };
    });
  deleteDraft.mockReset().mockImplementation(async (_acc: string, id: string) => {
    mailbox.delete(id);
    return { data: null, error: null };
  });
});

const flushAll = () => act(async () => new Promise(r => setTimeout(r, 0)));

const setup = () => {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const props = { open: true, snapshot: 'a', resetKey: {} as unknown };
  const hook = renderHook(
    ({ open, snapshot, resetKey }) =>
      useDraftSaver({
        open,
        snapshot,
        hasContent: true,
        initial: null,
        resetKey,
        build: async () =>
          ({
            accountId: 'acc',
            text: snapshot,
            to: ['a@b.pt'],
            cc: [],
            bcc: [],
            subject: 's',
          }) as never,
      }),
    { wrapper, initialProps: props }
  );
  const rerender = (next: Partial<typeof props>) => {
    Object.assign(props, next);
    hook.rerender({ ...props });
  };
  return { hook, rerender };
};

/** O que o MailComposer.sendNow faz (sem a espera de 2 s, que se testa à parte). */
const sendLikeComposer = (saver: ReturnType<typeof useDraftSaver>) => {
  saver.stop();
  const pending = saver.settled();
  const saved = saver.current();
  const late = pending.then(() => {
    const last = saver.current();
    if (last && last.id !== saved?.id) return deleteDraft('acc', last.id);
  });
  if (saved) void deleteDraft('acc', saved.id); // o envio apaga o rascunho que conhece
  return late;
};

describe('Enviar com gravações automáticas a meio', () => {
  it('caso do Moe, sem fechar o compositor: nenhum rascunho fica', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    let first!: Promise<boolean>;
    act(() => void (first = hook.result.current.flush()));
    await flushAll();
    rerender({ snapshot: 'c' });
    act(() => void hook.result.current.flush()); // 2.ª à espera
    const late = sendLikeComposer(hook.result.current);
    await act(async () => gates[0].resolve());
    await act(async () => {
      await first;
      await late;
    });
    await flushAll();
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect([...mailbox]).toEqual([]);
  });

  it('caso do Moe como no ecrã: Enviar fecha o compositor (open=false) antes de a 1.ª acabar', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    act(() => void hook.result.current.flush());
    await flushAll();
    rerender({ snapshot: 'c' });
    act(() => void hook.result.current.flush()); // 2.ª à espera
    const saver = hook.result.current;
    const late = sendLikeComposer(saver);
    // sendNow → onClose() → setDraft(null): o MailComposer continua montado com draft null
    rerender({ open: false });
    await act(async () => gates[0].resolve());
    await flushAll();
    if (gates[1]) await act(async () => gates[1].resolve());
    await act(async () => {
      await late;
    });
    await flushAll();
    // Nenhum rascunho fica, e a 2.ª já não arranca: fechar o compositor não tira a trava do Enviar
    expect([...mailbox]).toEqual([]);
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it('Enviar sem gravação em curso apaga o rascunho guardado', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    let first!: Promise<boolean>;
    act(() => void (first = hook.result.current.flush()));
    await flushAll();
    await act(async () => gates[0].resolve());
    await act(async () => void (await first));
    expect([...mailbox]).toEqual(['INBOX.Drafts:68']);
    await act(async () => void (await sendLikeComposer(hook.result.current)));
    expect([...mailbox]).toEqual([]);
  });

  it('descartar apaga o rascunho guardado', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    let first!: Promise<boolean>;
    act(() => void (first = hook.result.current.flush()));
    await flushAll();
    await act(async () => gates[0].resolve());
    await act(async () => void (await first));
    await act(async () => hook.result.current.discard());
    expect(deleteDraft).toHaveBeenCalledWith('acc', 'INBOX.Drafts:68');
    expect([...mailbox]).toEqual([]);
  });

  it('depois de reabrir (anular o envio), as gravações voltam a funcionar', async () => {
    const { hook, rerender } = setup();
    hook.result.current.stop();
    rerender({ snapshot: 'b' });
    let r1!: Promise<boolean>;
    act(() => void (r1 = hook.result.current.flush()));
    await act(async () => void (await r1));
    expect(saveDraft).not.toHaveBeenCalled(); // parado: não grava
    rerender({ open: false });
    rerender({ open: true, resetKey: {}, snapshot: 'reaberto' });
    rerender({ snapshot: 'reaberto + texto' });
    let r2!: Promise<boolean>;
    act(() => void (r2 = hook.result.current.flush()));
    await flushAll();
    await act(async () => gates[0].resolve());
    await act(async () => void (await r2));
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  // O mesmo saver serve o email seguinte: o rascunho do email enviado sai e o do novo fica.
  it('Enviar e abrir logo um email novo: o rascunho do email novo não é apagado', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    act(() => void hook.result.current.flush());
    await flushAll();
    const late = sendLikeComposer(hook.result.current); // 1.ª ainda a gravar (servidor lento)
    rerender({ open: false });
    // Email novo no mesmo compositor, e a gravação automática dele arranca
    rerender({ open: true, resetKey: {}, snapshot: 'novo' });
    rerender({ snapshot: 'novo + texto' });
    let second!: Promise<boolean>;
    act(() => void (second = hook.result.current.flush()));
    await act(async () => gates[0].resolve());
    await flushAll();
    await act(async () => gates[1].resolve());
    await act(async () => {
      await second;
      await late;
    });
    await flushAll();
    const novo = hook.result.current.current();
    expect(novo).not.toBeNull();
    expect([...mailbox]).toEqual([novo!.id]);
  });

  it('gravação lenta (mais de 2 s) não prende o envio e o rascunho dela é apagado no fim', async () => {
    const { hook, rerender } = setup();
    rerender({ snapshot: 'b' });
    act(() => void hook.result.current.flush());
    await flushAll();
    const saver = hook.result.current;
    // Como o sendNow: espera no máximo 2 s e segue com o que houver
    vi.useFakeTimers();
    saver.stop();
    const pending = saver.settled();
    let sentAt: string | null | undefined;
    const send = Promise.race([pending, new Promise(r => setTimeout(r, 2000))]).then(() => {
      sentAt = saver.current()?.id ?? null;
    });
    const late = pending.then(() => {
      const last = saver.current();
      if (last && last.id !== sentAt) return deleteDraft('acc', last.id);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
      await send;
    });
    vi.useRealTimers();
    expect(sentAt).toBeNull(); // o envio seguiu sem esperar pela gravação
    rerender({ open: false });
    await act(async () => gates[0].resolve()); // a gravação acaba muito depois
    await act(async () => void (await late));
    await flushAll();
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(deleteDraft).toHaveBeenCalledWith('acc', 'INBOX.Drafts:68');
    expect([...mailbox]).toEqual([]);
  });
});
