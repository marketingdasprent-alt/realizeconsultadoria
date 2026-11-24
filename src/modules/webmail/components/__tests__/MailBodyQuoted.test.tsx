import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Faixa de anexos no histórico citado, no corpo do email (MailBody). Tudo simulado.
const { list, get, workspace } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  workspace: { isPreview: false },
}));
vi.mock('../../services/mailService', () => ({ mailService: { list, get } }));
vi.mock('@/modules/workspace/context/workspaceContext', () => ({ useWorkspace: () => workspace }));
vi.mock('../AttachmentThumb', () => ({ AttachmentThumb: () => null }));

import { MailBody } from '../MailBody';
import type { MailMessage } from '../../types';

const QUOTED =
  '<p>Bom dia</p><div class="gmail_attr">Em 18 de novembro de 2026, 10:50, Maria Inês CSOutdoors escreveu:</div><blockquote>Segue.</blockquote>';

const opened = {
  id: 'aberto',
  accountId: 'acc',
  subject: 'Re: Pedido de cotação',
  html: QUOTED,
  text: '',
  attachments: [],
  from: { name: 'Marketing', email: 'marketing@useauto.pt' },
  to: [],
  cc: [],
  date: new Date(2026, 10, 19, 15, 54).toISOString(),
} as unknown as MailMessage;

const candidate = {
  id: 'citado',
  accountId: 'acc',
  threadId: null,
  from: { name: 'Maria Inês CSOutdoors', email: 'maria@csoutdoors.pt' },
  to: [],
  subject: 'Pedido de cotação',
  snippet: '',
  date: new Date(2026, 10, 18, 10, 50).toISOString(),
  unread: false,
  starred: false,
  hasAttachments: true,
};
const full = (filename: string) => ({
  ...opened,
  id: 'citado',
  attachments: [{ id: 'p2', filename, mime: 'application/pdf', size: 19 * 1024 }],
});

const renderBody = (onOpenAttachment = vi.fn()) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <MailBody message={opened} onDownload={vi.fn()} onOpenAttachment={onOpenAttachment} />
    </QueryClientProvider>
  );
  const iframe = screen.getByTitle('Conteúdo do email') as HTMLIFrameElement;
  /** O iframe acabou de carregar (o jsdom não carrega srcdoc: escreve-se o corpo à mão). */
  const load = async () => {
    iframe.contentDocument!.body.innerHTML = QUOTED;
    await act(async () => {
      fireEvent.load(iframe);
    });
  };
  return { ...view, iframe, load, qc };
};

const bars = (iframe: HTMLIFrameElement) =>
  Array.from(iframe.contentDocument!.querySelectorAll('[data-rz-quoted-attachments]'));
const flush = () => act(async () => new Promise(r => setTimeout(r, 0)));

beforeEach(() => {
  list.mockReset();
  get.mockReset();
  workspace.isPreview = false;
  list.mockResolvedValue({ data: { messages: [candidate] }, error: null });
});

describe('MailBody: anexos dos emails citados', () => {
  it('a captura do Thiago: faixa antes de «Em …, Maria Inês CSOutdoors escreveu:» e o clique abre o anexo', async () => {
    get.mockResolvedValue({ data: full('Orçamento.pdf'), error: null });
    const onOpen = vi.fn();
    const { iframe, load } = renderBody(onOpen);
    await load();
    await flush();
    const [bar] = bars(iframe);
    expect(bar).toBeTruthy();
    expect(bar.nextElementSibling?.textContent).toContain('escreveu:');
    const button = bar.querySelector('button')!;
    expect(button.textContent).toBe('Orçamento.pdf (19 KB)');
    button.click();
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'citado' }),
      expect.objectContaining({ id: 'p2' })
    );
  });

  it('abrir outra vez não repete a faixa', async () => {
    get.mockResolvedValue({ data: full('Orçamento.pdf'), error: null });
    const { iframe, load } = renderBody();
    await load();
    await flush();
    await act(async () => {
      fireEvent.load(iframe);
    });
    await flush();
    expect(bars(iframe)).toHaveLength(1);
  });

  it('abertura antiga que chega tarde não escreve', async () => {
    let lateResolve!: (v: unknown) => void;
    get
      .mockReturnValueOnce(new Promise(r => (lateResolve = r)))
      .mockResolvedValue({ data: full('Novo.pdf'), error: null });
    const { iframe, load, qc } = renderBody();
    await load();
    await flush();
    // Nova abertura (ex.: o iframe recarregou): a anterior ainda espera pelo email citado
    qc.removeQueries({ queryKey: ['mail', 'message'] });
    await load();
    await flush();
    await act(async () => lateResolve({ data: full('Antigo.pdf'), error: null }));
    await flush();
    const names = bars(iframe).flatMap(b =>
      Array.from(b.querySelectorAll('button'), x => x.textContent)
    );
    expect(names).toEqual(['Novo.pdf (19 KB)']);
  });

  it('na pré-visualização não pesquisa', async () => {
    workspace.isPreview = true;
    const { iframe, load } = renderBody();
    await load();
    await flush();
    expect(list).not.toHaveBeenCalled();
    expect(bars(iframe)).toHaveLength(0);
  });

  it('pesquisa que falha: o email lê-se na mesma, sem faixa nem erro', async () => {
    list.mockResolvedValue({ data: null, error: { code: 'unavailable', message: '' } });
    const { iframe, load } = renderBody();
    await load();
    await flush();
    expect(bars(iframe)).toHaveLength(0);
    expect(iframe.contentDocument!.body.textContent).toContain('Segue.');
  });

  it('email citado sem anexos (hasAttachments false): não abre o email nem põe faixa', async () => {
    list.mockResolvedValue({
      data: { messages: [{ ...candidate, hasAttachments: false }] },
      error: null,
    });
    const { iframe, load } = renderBody();
    await load();
    await flush();
    expect(get).not.toHaveBeenCalled();
    expect(bars(iframe)).toHaveLength(0);
  });
});
