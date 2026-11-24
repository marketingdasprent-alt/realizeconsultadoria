import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailService } from '../../services/mailService';
import { useMailMessage, usePrefetchMessage, usePrefetchTop } from '../useMailbox';
import { ThreadItem } from '../../components/ThreadItem';
import type { MailSummary } from '../../types';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({
  useWorkspace: () => ({ isPreview: false, mailOnly: false }),
}));
vi.mock('../../lib/demoStore', () => ({ useDemoMail: () => ({ mails: [] }) }));
vi.mock('@/modules/workspace/components/UserAvatar', () => ({ UserAvatar: () => null }));
vi.mock('../../components/MailBody', () => ({
  MailBody: ({ message }: { message: { text: string } }) => <p>{message.text}</p>,
}));

const summary: MailSummary = {
  id: 'qa-message',
  accountId: 'qa-account',
  threadId: null,
  from: { name: 'Teste fictício', email: 'qa@example.invalid' },
  to: [],
  subject: 'Teste fictício',
  snippet: 'Resumo fictício',
  date: '2026-11-20T10:00:00Z',
  unread: false,
  starred: false,
  hasAttachments: true,
};
const row = {
  id: summary.id,
  text: 'Corpo fictício',
  html: '<p>Corpo fictício</p>',
  attachments: [{ id: 'attachment', filename: 'teste.pdf', mime: 'application/pdf', size: 12 }],
};
const success = () => ({ data: { ok: true, data: row }, error: null });
const never = () => new Promise<never>(() => undefined);
const clients: QueryClient[] = [];
function wrapper() {
  // Keep the app/library retry default: each opening must override it explicitly.
  const client = new QueryClient();
  clients.push(client);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
const advance = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
beforeEach(() => {
  vi.useFakeTimers();
  invoke.mockReset();
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(c => c.clear());
  vi.useRealTimers();
});

describe('abertura de email com respostas simuladas, sem rede real', () => {
  it('preserva corpo e anexos no sucesso', async () => {
    invoke.mockResolvedValue(success());
    const result = await mailService.get(summary.accountId, summary.id);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      text: row.text,
      html: row.html,
      attachments: row.attachments,
    });
  });

  it('invocação que nunca resolve termina exatamente aos 30 s e aborta sem repetir', async () => {
    invoke.mockImplementation(never);
    const hook = renderHook(() => useMailMessage(summary), { wrapper: wrapper() });
    await advance(29_999);
    expect(hook.result.current.isLoading).toBe(true);
    await advance(1);
    expect(invoke.mock.calls[0][1].signal.aborted).toBe(true);
    await advance(1); // React Query notifica o observador na próxima tarefa.
    expect(hook.result.current.isError).toBe(true);
    expect(hook.result.current.isLoading).toBe(false);
    expect(invoke.mock.calls[0][1].signal.aborted).toBe(true);
    await advance(60_000);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each(['rejeição de rede', 'erro devolvido', 'ok sem dados'])(
    '%s sai da espera e permite recuperação manual',
    async kind => {
      if (kind === 'rejeição de rede')
        invoke.mockRejectedValueOnce(new TypeError('Network failed'));
      else if (kind === 'erro devolvido')
        invoke.mockResolvedValueOnce({ data: null, error: new Error('rede') });
      else invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
      invoke.mockResolvedValue(success());
      const hook = renderHook(() => useMailMessage(summary), { wrapper: wrapper() });
      await advance();
      expect(hook.result.current.isError).toBe(true);
      await advance(60_000);
      expect(invoke).toHaveBeenCalledTimes(1);
      act(() => hook.result.current.retry());
      await advance();
      expect(hook.result.current.message?.text).toBe(row.text);
      expect(hook.result.current.isError).toBe(false);
      expect(invoke).toHaveBeenCalledTimes(2);
    }
  );

  it('prefetch por hover não bloqueia outra abertura e libera a fila após o limite', async () => {
    invoke.mockImplementation((_fn, { body }) =>
      body.message_id === summary.id ? never() : Promise.resolve(success())
    );
    const hook = renderHook(
      () => ({
        prefetch: usePrefetchMessage(),
        message: useMailMessage({ ...summary, id: 'selected' }),
      }),
      { wrapper: wrapper() }
    );
    act(() => hook.result.current.prefetch(summary));
    await advance(250);
    expect(hook.result.current.message.message).not.toBeNull();
    await advance(30_000);
    expect(invoke).toHaveBeenCalledTimes(2);
    act(() => hook.result.current.prefetch({ ...summary, id: 'next-hover' }));
    await advance(250);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('prefetch dos primeiros emails avança após falha, sem repetir o primeiro', async () => {
    invoke.mockImplementation((_fn, { body }) =>
      body.message_id === summary.id ? never() : Promise.resolve(success())
    );
    renderHook(() => usePrefetchTop([summary, { ...summary, id: 'second' }]), {
      wrapper: wrapper(),
    });
    await advance(800);
    expect(invoke).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].body.message_id).toBe('second');
  });

  it('mensagem de conversa não fica com indicador infinito após o limite', async () => {
    invoke.mockImplementation(never);
    render(<ThreadItem mail={summary} onDownload={vi.fn()} onOpenAttachment={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    await advance(30_000);
    await advance(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('A abrir…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar outra vez' })).toBeInTheDocument();
    await advance(60_000);
    expect(invoke).toHaveBeenCalledTimes(1);
    invoke.mockResolvedValueOnce(success());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    await advance(1);
    expect(screen.getByText(row.text)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('A abrir…')).not.toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
