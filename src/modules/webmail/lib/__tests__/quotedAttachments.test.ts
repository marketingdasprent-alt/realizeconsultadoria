import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Anexos dos emails citados no histórico (pedido do Thiago 24/11). Tudo simulado: sem caixa real.
const { list, get } = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock('../../services/mailService', () => ({ mailService: { list, get } }));

import { findQuotedHeaders, parseHeaderDate, sameName } from '../quotedHeaders';
import {
  baseSubject,
  conversationCandidates,
  insertAttachmentBar,
  loadMessage,
  matchHeader,
  visibleAttachments,
} from '../quotedAttachments';
import { forwardedHtml } from '../forward';
import type { MailMessage, MailSummary } from '../../types';

const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const at = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(y, mo - 1, d, h, mi);

const summary = (
  id: string,
  from: { name: string | null; email: string },
  date: Date,
  extra = {}
) =>
  ({
    id,
    accountId: 'acc',
    threadId: null,
    from,
    to: [],
    subject: 'Re: Pedido de cotação',
    snippet: '',
    date: date.toISOString(),
    unread: false,
    starred: false,
    hasAttachments: true,
    ...extra,
  }) as MailSummary;

const message = (id: string, attachments: { id: string; filename: string; size: number }[]) =>
  ({
    id,
    accountId: 'acc',
    subject: 'Re: Pedido de cotação',
    attachments: attachments.map(a => ({ ...a, mime: 'application/pdf' })),
  }) as unknown as MailMessage;

describe('parseHeaderDate', () => {
  it.each([
    ['19 de novembro de 2026 15:54', at(2026, 11, 19, 15, 54)],
    ['quarta-feira, 19 de novembro de 2026 15:54', at(2026, 11, 19, 15, 54)],
    ['19/11/2026 15:54', at(2026, 11, 19, 15, 54)],
    ['Wednesday, November 19, 2026 3:54 PM', at(2026, 11, 19, 15, 54)],
    ['2026-11-19 15:54', at(2026, 11, 19, 15, 54)],
    ['18 de novembro de 2026, 10:50, Maria Inês CSOutdoors', at(2026, 11, 18, 10, 50)],
    ['qua., 19 de nov. de 2026 às 15:54', at(2026, 11, 19, 15, 54)],
  ])('%s', (raw, expected) => {
    expect(parseHeaderDate(raw)?.getTime()).toBe(expected.getTime());
  });

  it('sem data percetível: null', () => {
    expect(parseHeaderDate('ontem à tarde')).toBeNull();
  });
});

describe('findQuotedHeaders', () => {
  it('Outlook em português (com quebras de linha no HTML)', () => {
    const [h] = findQuotedHeaders(
      doc(`<p>Olá</p><div id="divRplyFwdMsg"><b>De:</b> marketing@useauto.pt &lt;marketing@useauto.pt&gt;<br>
<b>Enviada:</b> 19 de novembro de 2026 15:54<br>
<b>Para:</b> Maria &lt;maria@csoutdoors.pt&gt;<br>
<b>Assunto:</b> Re: Pedido de cotação</div>`)
    );
    expect(h).toMatchObject({ from: 'marketing@useauto.pt' });
    expect(h.date?.getTime()).toBe(at(2026, 11, 19, 15, 54).getTime());
  });

  it('Outlook em inglês', () => {
    const [h] = findQuotedHeaders(
      doc(`<div><b>From:</b> Rui Costa &lt;rui@exemplo.pt&gt;
<br><b>Sent:</b> Wednesday, November 19, 2026 3:54 PM
<br><b>To:</b> a@b.pt<br><b>Subject:</b> RE: x</div>`)
    );
    expect(h).toMatchObject({ from: 'rui@exemplo.pt', name: 'Rui Costa' });
    expect(h.date?.getTime()).toBe(at(2026, 11, 19, 15, 54).getTime());
  });

  // QA 24/11: linhas separadas só por <br> no HTML («…>Enviado:») têm de ser reconhecidas.
  it('Outlook na web: linhas só com <br>, sem espaços no HTML', () => {
    const headers = findQuotedHeaders(
      doc(
        '<div id="divRplyFwdMsg"><font><b>De:</b> Rui Costa &lt;rui@exemplo.pt&gt;<br><b>Enviado:</b> 19 de novembro de 2026 15:54<br><b>Para:</b> a@b.pt<br><b>Assunto:</b> Re: x</font></div>'
      )
    );
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatchObject({ from: 'rui@exemplo.pt', name: 'Rui Costa' });
    expect(headers[0].date?.getTime()).toBe(at(2026, 11, 19, 15, 54).getTime());
  });

  it('Gmail «Em … escreveu:» só com o nome (a captura do Thiago)', () => {
    const [h] = findQuotedHeaders(
      doc(
        '<div class="gmail_attr">Em 18 de novembro de 2026, 10:50, Maria Inês CSOutdoors escreveu:<br></div><blockquote>…</blockquote>'
      )
    );
    expect(h).toMatchObject({ from: null, name: 'Maria Inês CSOutdoors' });
    expect(h.date?.getTime()).toBe(at(2026, 11, 18, 10, 50).getTime());
  });

  it('Gmail «Em … escreveu:» com o email', () => {
    const [h] = findQuotedHeaders(
      doc(
        '<div class="gmail_attr">Em qua., 19 de nov. de 2026 às 15:54, Maria Inês &lt;<a href="mailto:maria@csoutdoors.pt">maria@csoutdoors.pt</a>&gt; escreveu:<br></div>'
      )
    );
    expect(h.from).toBe('maria@csoutdoors.pt');
    expect(h.date?.getTime()).toBe(at(2026, 11, 19, 15, 54).getTime());
  });

  // QA 24/11: linhas separadas só por <br> no HTML («…>Enviado:») têm de ser reconhecidas.
  it('reencaminhamento do próprio Realize («De:/Data:»)', () => {
    const html = forwardedHtml({
      id: 'm',
      accountId: 'acc',
      subject: 'Pedido de cotação',
      from: { name: 'Maria Inês', email: 'maria@csoutdoors.pt' },
      to: [{ name: null, email: 'marketing@useauto.pt' }],
      cc: [],
      date: at(2026, 11, 19, 15, 54).toISOString(),
      html: '<p>Segue a cotação.</p>',
      text: 'Segue a cotação.',
      attachments: [],
    } as unknown as MailMessage);
    const headers = findQuotedHeaders(doc(`<p>Veja abaixo.</p>${html}`));
    expect(headers).toHaveLength(1);
    expect(headers[0].from).toBe('maria@csoutdoors.pt');
    expect(headers[0].date?.getTime()).toBe(at(2026, 11, 19, 15, 54).getTime());
  });

  it('cabeçalho dentro de outro: fica o mais interior, um por email citado', () => {
    const headers = findQuotedHeaders(
      doc(`<div><div>De: a@x.pt
Enviada: 19/11/2026 15:54</div><blockquote><div>Em 18 de novembro de 2026, 10:50, Maria Inês escreveu:</div></blockquote></div>`)
    );
    expect(headers.map(h => h.from ?? h.name)).toEqual(['a@x.pt', 'Maria Inês']);
    headers.forEach(h => expect(h.element.textContent!.length).toBeLessThan(80));
  });

  it('texto que menciona «De:» sem ser cabeçalho não conta', () => {
    expect(findQuotedHeaders(doc('<p>De: amanhã falamos. Obrigado.</p>'))).toEqual([]);
  });
});

describe('sameName', () => {
  it('ignora acentos e maiúsculas; um nome dentro do outro com 2+ palavras', () => {
    expect(sameName('Maria Inês CSOutdoors', 'maria ines csoutdoors')).toBe(true);
    expect(sameName('Maria Inês', 'Maria Inês CSOutdoors')).toBe(true);
  });
  it('nome parecido de outra pessoa não corresponde', () => {
    expect(sameName('Maria Inês Silva', 'Maria Inês CSOutdoors')).toBe(false);
    expect(sameName('Maria', 'Maria Inês CSOutdoors')).toBe(false);
    expect(sameName(null, 'Maria')).toBe(false);
  });
});

describe('matchHeader', () => {
  const maria = { name: 'Maria Inês CSOutdoors', email: 'maria@csoutdoors.pt' };
  const header = (h: Partial<Parameters<typeof matchHeader>[0]>) =>
    ({
      element: document.createElement('div'),
      from: null,
      name: null,
      date: null,
      ...h,
    }) as Parameters<typeof matchHeader>[0];

  it('escolhe, entre vários do mesmo remetente, o de data mais próxima', () => {
    const list = [
      summary('a', maria, at(2026, 11, 17, 9, 0)),
      summary('b', maria, at(2026, 11, 18, 10, 51)),
      summary('c', maria, at(2026, 11, 20, 8, 0)),
    ];
    expect(
      matchHeader(
        header({ name: 'Maria Inês CSOutdoors', date: at(2026, 11, 18, 10, 50) }),
        list,
        'x'
      )?.id
    ).toBe('b');
  });

  it('pelo email quando o cabeçalho o traz', () => {
    const list = [
      summary('a', { name: 'Outro', email: 'outro@x.pt' }, at(2026, 11, 19, 15, 54)),
      summary('b', { name: null, email: 'Marketing@UseAuto.pt' }, at(2026, 11, 19, 15, 55)),
    ];
    expect(
      matchHeader(
        header({ from: 'marketing@useauto.pt', date: at(2026, 11, 19, 15, 54) }),
        list,
        'x'
      )?.id
    ).toBe('b');
  });

  it('nome parecido de outra pessoa não corresponde', () => {
    const list = [
      summary('a', { name: 'Maria Inês Silva', email: 'mis@x.pt' }, at(2026, 11, 18, 10, 50)),
    ];
    expect(
      matchHeader(
        header({ name: 'Maria Inês CSOutdoors', date: at(2026, 11, 18, 10, 50) }),
        list,
        'x'
      )
    ).toBeNull();
  });

  it('sem data e 2 candidatos: nada; sem data e 1: esse', () => {
    const two = [
      summary('a', maria, at(2026, 11, 17, 9, 0)),
      summary('b', maria, at(2026, 11, 18, 9, 0)),
    ];
    expect(matchHeader(header({ name: maria.name }), two, 'x')).toBeNull();
    expect(matchHeader(header({ name: maria.name }), two.slice(0, 1), 'x')?.id).toBe('a');
  });

  it('o próprio email aberto fica de fora', () => {
    const list = [summary('aberto', maria, at(2026, 11, 18, 10, 50))];
    expect(
      matchHeader(header({ name: maria.name, date: at(2026, 11, 18, 10, 50) }), list, 'aberto')
    ).toBeNull();
  });

  it('mais de 26 h de diferença: nada', () => {
    const list = [summary('a', maria, at(2026, 11, 20, 13, 0))];
    expect(
      matchHeader(header({ name: maria.name, date: at(2026, 11, 18, 10, 50) }), list, 'x')
    ).toBeNull();
  });
});

describe('assunto, anexos visíveis e pesquisa', () => {
  it('baseSubject tira Re/RES/Fwd/ENC/TR repetidos', () => {
    expect(baseSubject('RES: Re: ENC: Fwd: Pedido de cotação')).toBe('Pedido de cotação');
    expect(baseSubject('Re[2]: TR: Proposta')).toBe('Proposta');
  });

  it('visibleAttachments esconde image00N do Outlook, mas não outras imagens', () => {
    const m = message('m', [
      { id: '1', filename: 'image001.png', size: 1 },
      { id: '2', filename: 'Orçamento.pdf', size: 1 },
      { id: '3', filename: 'foto-outdoor.jpg', size: 1 },
    ]);
    expect(visibleAttachments(m).map(a => a.filename)).toEqual([
      'Orçamento.pdf',
      'foto-outdoor.jpg',
    ]);
  });

  it('pesquisa o assunto base em todas as pastas e guarda em cache', async () => {
    list.mockResolvedValue({
      data: { messages: [summary('a', { name: 'x', email: 'x@y.pt' }, new Date())] },
      error: null,
    });
    const qc = new QueryClient();
    const m = { ...message('m', []), subject: 'RE: Pedido de cotação' };
    await conversationCandidates(qc, m);
    await conversationCandidates(qc, m);
    expect(list).toHaveBeenCalledTimes(1);
    const args = list.mock.calls[0];
    expect(args[2]).toBe('Pedido de cotação');
    expect(args[8]).toEqual({ body: false });
  });

  it('loadMessage usa a chave do leitor (não volta a pedir o que já está aberto)', async () => {
    get.mockReset();
    const qc = new QueryClient();
    const full = message('b', []);
    qc.setQueryData(['mail', 'message', 'acc', 'b'], full);
    await expect(
      loadMessage(qc, summary('b', { name: null, email: 'x@y.pt' }, new Date()))
    ).resolves.toBe(full);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('insertAttachmentBar', () => {
  const setup = () => {
    const d = doc('<p>Olá</p><div id="h">De: a@x.pt</div>');
    const element = d.getElementById('h')!;
    const header = { element, from: 'a@x.pt', name: null, date: null };
    return { d, header };
  };

  it('faixa antes do cabeçalho, botões focáveis, clique abre o anexo certo, sem repetir', () => {
    const { d, header } = setup();
    const full = message('citado', [
      { id: 'p1', filename: 'Orçamento.pdf', size: 19 * 1024 },
      { id: 'p2', filename: 'Planta.pdf', size: 2 * 1024 * 1024 },
    ]);
    const onOpen = vi.fn();
    insertAttachmentBar(header, full, full.attachments, onOpen);
    insertAttachmentBar(header, full, full.attachments, onOpen);
    const bars = d.querySelectorAll('[data-rz-quoted-attachments]');
    expect(bars).toHaveLength(1);
    expect(bars[0].nextElementSibling).toBe(header.element);
    expect(bars[0].getAttribute('role')).toBe('group');
    expect(bars[0].getAttribute('aria-label')).toBe('Anexos deste email (2)');
    const buttons = Array.from(bars[0].querySelectorAll('button'));
    expect(buttons.map(b => b.textContent)).toEqual([
      'Orçamento.pdf (19 KB)',
      'Planta.pdf (2,0 MB)',
    ]);
    buttons.forEach(b => {
      expect(b.type).toBe('button');
      expect(b.tabIndex).toBe(0);
    });
    buttons[1].click();
    expect(onOpen).toHaveBeenCalledWith(full.attachments[1]);
  });

  it('sem anexos não põe faixa', () => {
    const { d, header } = setup();
    insertAttachmentBar(header, message('c', []), [], vi.fn());
    expect(d.querySelector('[data-rz-quoted-attachments]')).toBeNull();
  });
});
