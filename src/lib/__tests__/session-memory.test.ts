import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (event: string, session: { user?: { id: string } } | null) => void;
const auth = vi.hoisted(() => ({ listener: null as AuthListener | null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

import { persistQueries } from '../query-persist';
import { onSessionReset, resetSessionMemory } from '../session-memory';
import { composeSession } from '@/modules/webmail/lib/composeSession';
import { attachmentClipboard } from '@/modules/webmail/lib/attachmentClipboard';
import { dropToConversation, takeDropped } from '@/modules/messenger/lib/dropToConversation';
import type { ComposeDraft } from '@/modules/webmail/types';

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

  it('a mesma conta a renovar o token mantém o rascunho', () => {
    session('u1');
    stop = persistQueries(new QueryClient());
    composeSession.set({ subject: 'Em curso' } as unknown as ComposeDraft);

    auth.listener?.('TOKEN_REFRESHED', { user: { id: 'u1' } });
    auth.listener?.('SIGNED_IN', { user: { id: 'u1' } });

    expect(composeSession.get()).not.toBeNull();
  });
});
