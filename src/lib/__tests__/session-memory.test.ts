import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (event: string, session: { user?: { id: string } } | null) => void;
const auth = vi.hoisted(() => ({
  listener: null as AuthListener | null,
  signed: [] as { resolve: (url: string) => void }[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    storage: {
      from: () => ({
        // Cada pedido fica à espera: o teste decide quando "a rede responde".
        createSignedUrl: vi.fn(
          () =>
            new Promise(resolve => {
              auth.signed.push({
                resolve: url => resolve({ data: { signedUrl: url }, error: null }),
              });
            })
        ),
      }),
    },
  },
}));

import { loadAttachment } from '@/modules/webmail/lib/attachments';
import { openPrintPreview, usePrintPreview } from '../print-preview';
import { act, renderHook } from '@testing-library/react';
import { toast, useToast } from '@/hooks/use-toast';
import { persistQueries } from '../query-persist';
import { onSessionReset, resetSessionMemory, sessionEpoch } from '../session-memory';
import { feedService } from '@/modules/social/services/feedService';
import { composeSession } from '@/modules/webmail/lib/composeSession';
import { attachmentClipboard } from '@/modules/webmail/lib/attachmentClipboard';
import { dropToConversation, takeDropped } from '@/modules/messenger/lib/dropToConversation';
import type { ComposeDraft } from '@/modules/webmail/types';

const mail = vi.hoisted(() => ({
  attachment: vi.fn(async () => ({
    data: { filename: 'a.txt', mime: 'text/plain', base64: 'eA==' },
    error: null,
  })),
}));
vi.mock('@/modules/webmail/services/mailService', () => ({
  mailService: { attachment: mail.attachment },
}));

const currentPreview = () => renderHook(() => usePrintPreview()).result.current;

const session = (userId: string) =>
  localStorage.setItem('sb-proj-auth-token', JSON.stringify({ user: { id: userId } }));

const file = () => new File(['x'], 'fatura.pdf', { type: 'application/pdf' });

/** Põe em memória o que uma conta deixa para trás ao sair sem recarregar a app. */
const leaveTracesOfAccountOne = () => {
  composeSession.set({ subject: 'Proposta da conta 1' } as unknown as ComposeDraft);
  attachmentClipboard.copy([file()]);
  dropToConversation('conversa-1', [file()]);
};

const expectNoTraces = () => {
  expect(composeSession.get()).toBeNull();
  expect(attachmentClipboard.get()).toEqual([]);
  expect(takeDropped('conversa-1')).toEqual([]);
};

describe('memória da sessão (módulos com estado fora do React)', () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
    auth.listener = null;
    localStorage.clear();
    composeSession.set(null);
    attachmentClipboard.clear();
    takeDropped('conversa-1');
  });

  it('resetSessionMemory corre todos os registos e um que falhe não impede os outros', () => {
    const first = vi.fn(() => {
      throw new Error('falhou');
    });
    const second = vi.fn();
    const off = [onSessionReset(first), onSessionReset(second)];
    resetSessionMemory();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    off.forEach(fn => fn());
    resetSessionMemory();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('resetSessionMemory esquece o rascunho de email, os anexos copiados e os ficheiros largados', () => {
    leaveTracesOfAccountOne();
    resetSessionMemory();
    expectNoTraces();
  });

  it('terminar a sessão esquece o que a conta deixou em memória', () => {
    session('u1');
    stop = persistQueries(new QueryClient());
    leaveTracesOfAccountOne();

    auth.listener?.('SIGNED_OUT', null);

    expectNoTraces();
  });

  it('outra conta a entrar no mesmo separador não herda o rascunho nem os anexos da anterior', () => {
    session('u1');
    stop = persistQueries(new QueryClient());
    leaveTracesOfAccountOne();

    session('u2');
    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });

    expectNoTraces();
  });

  it('a impressão aberta pela conta anterior fecha-se', () => {
    openPrintPreview('<html><head></head><body>folha de ponto</body></html>', 'Ponto');
    expect(currentPreview()).not.toBeNull();
    resetSessionMemory();
    expect(currentPreview()).toBeNull();
  });

  it('os anexos de email já buscados pela conta anterior não são servidos à seguinte', async () => {
    mail.attachment.mockClear();
    await loadAttachment('caixa', 'm1', 'a1', 'a.txt');
    await loadAttachment('caixa', 'm1', 'a1', 'a.txt');
    expect(mail.attachment).toHaveBeenCalledTimes(1);

    resetSessionMemory();
    await loadAttachment('caixa', 'm1', 'a1', 'a.txt');
    expect(mail.attachment).toHaveBeenCalledTimes(2);
  });

  it('o pedido de anexo da conta anterior que termina tarde não apaga o da conta nova', async () => {
    let answerOld!: (value: unknown) => void;
    mail.attachment.mockClear();
    mail.attachment.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answerOld = resolve;
        }) as never
    );
    const old = loadAttachment('caixa', 'm2', 'a2', 'a.txt');
    resetSessionMemory(); // outra conta entrou
    await loadAttachment('caixa', 'm2', 'a2', 'a.txt'); // a conta nova pede o mesmo anexo
    expect(mail.attachment).toHaveBeenCalledTimes(2);

    answerOld({ data: { filename: 'a.txt', mime: 'text/plain', base64: 'eA==' }, error: null });
    await old;
    // o da conta nova continua em cache: não volta a pedir
    await loadAttachment('caixa', 'm2', 'a2', 'a.txt');
    expect(mail.attachment).toHaveBeenCalledTimes(2);
  });

  it('os avisos (toasts) da conta anterior desaparecem', () => {
    act(() => {
      toast({ title: 'Nova mensagem de um cliente da conta 1' });
    });
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts.some(t => t.open)).toBe(true);

    act(() => resetSessionMemory());

    expect(result.current.toasts.every(t => !t.open)).toBe(true);
  });

  it('a época da sessão muda a cada reset', () => {
    const before = sessionEpoch();
    resetSessionMemory();
    expect(sessionEpoch()).toBe(before + 1);
  });

  it('um URL assinado pedido pela conta anterior e que chega depois da troca não fica em cache', async () => {
    auth.signed.length = 0;
    // Pedido em voo da conta 1…
    const inFlight = feedService.getFileUrl('feed/ficheiro-da-conta-1.png');
    // …a conta muda antes de a rede responder…
    resetSessionMemory();
    auth.signed[0].resolve('https://storage/assinado-para-conta-1');
    await inFlight;

    // …a conta 2 pede o mesmo caminho: tem de pedir o seu, não receber o da conta 1.
    const second = feedService.getFileUrl('feed/ficheiro-da-conta-1.png');
    expect(auth.signed).toHaveLength(2);
    auth.signed[1].resolve('https://storage/assinado-para-conta-2');
    expect((await second).data).toBe('https://storage/assinado-para-conta-2');
  });

  it('a mesma conta a renovar o token mantém o rascunho', () => {
    session('u1');
    stop = persistQueries(new QueryClient());
    composeSession.set({ subject: 'Em curso' } as unknown as ComposeDraft);

    auth.listener?.('TOKEN_REFRESHED', { user: { id: 'u1' } });
    auth.listener?.('SIGNED_IN', { user: { id: 'u1' } });

    expect(composeSession.get()).not.toBeNull();
  });
});
