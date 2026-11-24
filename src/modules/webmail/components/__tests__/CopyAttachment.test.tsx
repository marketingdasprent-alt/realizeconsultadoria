import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// «Copiar anexo» (AttachmentPreview) e «Colar» / Ctrl+V (MailComposer), tudo simulado.
const { toast, attachmentFile } = vi.hoisted(() => ({
  toast: vi.fn(),
  attachmentFile: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ toast, useToast: () => ({ toast }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));
vi.mock('../../lib/attachments', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/attachments')>()),
  attachmentFile,
  // O visualizador também carrega o anexo para o mostrar: fica a carregar (não interessa aqui).
  loadAttachment: vi.fn(() => new Promise(() => {})),
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
    flush: vi.fn(),
    save: vi.fn(),
    isDirty: () => false,
    stop: vi.fn(),
  }),
}));

import { AttachmentPreview, type PreviewTarget } from '../AttachmentPreview';
import { MailComposer } from '../MailComposer';
import { attachmentClipboard } from '../../lib/attachmentClipboard';

const target = (filename: string, id = filename): PreviewTarget => ({
  accountId: 'acc',
  messageId: 'm1',
  attachment: { id, filename, mime: 'application/pdf', size: 10 } as never,
});
const file = (name: string, bytes: number) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

const renderPreview = (t: PreviewTarget) =>
  render(
    <AttachmentPreview target={t} onClose={vi.fn()} onDownload={vi.fn()} onNewEmail={vi.fn()} />
  );

const toastTitles = () => toast.mock.calls.map(([arg]) => arg.title as string);
const lastToast = () => toast.mock.calls.at(-1)![0];

beforeEach(() => {
  toast.mockClear();
  attachmentFile.mockReset();
  attachmentClipboard.clear();
});
afterEach(() => attachmentClipboard.clear());

describe('Copiar anexo', () => {
  it('sucesso: o ficheiro fica para colar e o aviso diz nome e tamanho', async () => {
    attachmentFile.mockResolvedValueOnce(file('Fatura.pdf', 19 * 1024));
    renderPreview(target('Fatura.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(attachmentClipboard.get()).toHaveLength(1));
    expect(attachmentClipboard.get()[0].name).toBe('Fatura.pdf');
    expect(lastToast().title).toBe('Anexo copiado: Fatura.pdf (19 KB)');
  });

  it('sucesso substitui a cópia anterior', async () => {
    attachmentClipboard.copy([file('Antigo.pdf', 100)]);
    attachmentFile.mockResolvedValueOnce(file('Novo.pdf', 3 * 1024 * 1024));
    renderPreview(target('Novo.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(attachmentClipboard.get()[0]?.name).toBe('Novo.pdf'));
    expect(attachmentClipboard.get()).toHaveLength(1);
    expect(lastToast().title).toBe('Anexo copiado: Novo.pdf (3,0 MB)');
  });

  it('falha depois de uma cópia anterior: nada fica para colar e o aviso diz porquê', async () => {
    attachmentClipboard.copy([file('Antigo.pdf', 100)]);
    attachmentFile.mockRejectedValueOnce({ code: 'unavailable', message: '' });
    renderPreview(target('Grande.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(lastToast()?.title).toBe('Não foi possível copiar o anexo'));
    expect(attachmentClipboard.get()).toEqual([]);
    expect(lastToast().variant).toBe('destructive');
    expect(lastToast().description).toBeTruthy();
  });

  // QA 24/11: o aviso não pode mostrar texto interno do erro («vazio»).
  it('ficheiro vazio conta como falha, com uma explicação legível', async () => {
    attachmentClipboard.copy([file('Antigo.pdf', 100)]);
    attachmentFile.mockResolvedValueOnce(file('Vazio.pdf', 0));
    renderPreview(target('Vazio.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(lastToast()?.title).toBe('Não foi possível copiar o anexo'));
    expect(attachmentClipboard.get()).toEqual([]);
    // Não deve mostrar o texto interno do erro ("vazio") a quem usa
    expect(lastToast().description).not.toBe('vazio');
  });

  it('ficheiro vazio: aviso «O ficheiro veio vazio.»; erro sem código (rede): frase de recurso', async () => {
    attachmentFile.mockResolvedValueOnce(file('Vazio.pdf', 0));
    const view = renderPreview(target('Vazio.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(lastToast()?.description).toBe('O ficheiro veio vazio.'));
    view.unmount();
    attachmentFile.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPreview(target('Rede.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() =>
      expect(lastToast()?.description).toBe('Tente outra vez, ou use "Novo email com anexo".')
    );
    expect(attachmentClipboard.get()).toEqual([]);
  });

  it('enquanto busca: botão desativado com «A copiar…», e volta ao fim', async () => {
    let resolve!: (f: File) => void;
    attachmentFile.mockReturnValueOnce(new Promise<File>(r => (resolve = r)));
    renderPreview(target('Lento.pdf'));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    const busy = await screen.findByRole('button', { name: /A copiar…/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busy);
    expect(attachmentFile).toHaveBeenCalledTimes(1);
    await act(async () => resolve(file('Lento.pdf', 2048)));
    const idle = await screen.findByRole('button', { name: /^Copiar$/ });
    expect(idle).toBeEnabled();
  });
});

describe('Colar no email', () => {
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

  const renderComposer = () =>
    render(
      <MailComposer
        draft={{ accountId: 'acc' }}
        accounts={[account]}
        onClose={vi.fn()}
        onSend={vi.fn(async () => true)}
        toBase64={vi.fn(async () => '')}
      />
    );

  const pasteEvent = (files: File[], text = '') => ({
    clipboardData: { files, getData: (type: string) => (type === 'text' ? text : '') },
  });

  it('a faixa «Colar» mostra nome e tamanho; Colar junta o ficheiro e confirma', async () => {
    attachmentClipboard.copy([file('Fatura.pdf', 19 * 1024)]);
    renderComposer();
    expect(await screen.findByText('Fatura.pdf (19 KB)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Colar' }));
    expect(lastToast().title).toBe('Anexo colado: Fatura.pdf (19 KB)');
    expect(attachmentClipboard.get()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Colar' })).toBeNull();
    expect(screen.getAllByText(/Fatura\.pdf/).length).toBeGreaterThan(0);
  });

  it('Ctrl+V sem ficheiros do sistema cola o anexo copiado no Realize', async () => {
    attachmentClipboard.copy([file('Orcamento.pdf', 5000)]);
    renderComposer();
    const area = await screen.findByText('Orcamento.pdf (5 KB)');
    fireEvent.paste(area, pasteEvent([]));
    expect(lastToast().title).toBe('Anexo colado: Orcamento.pdf (5 KB)');
    expect(attachmentClipboard.get()).toEqual([]);
  });

  it('Ctrl+V com ficheiros do sistema: cola esses, diz quais e mantém o do Realize', async () => {
    attachmentClipboard.copy([file('Realize.pdf', 5000)]);
    renderComposer();
    const area = await screen.findByText('Realize.pdf (5 KB)');
    fireEvent.paste(area, pasteEvent([file('DoWindows.pdf', 2 * 1024 * 1024)]));
    expect(lastToast().title).toBe('Anexo colado: DoWindows.pdf (2,0 MB)');
    expect(attachmentClipboard.get().map(f => f.name)).toEqual(['Realize.pdf']);
    expect(toastTitles()).not.toContain('Anexo colado: Realize.pdf (5 KB)');
  });
});
