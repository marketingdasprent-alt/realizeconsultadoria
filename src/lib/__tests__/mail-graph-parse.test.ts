// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  graphAttachmentInfo,
  graphRecipient,
  parseGraphMessage,
  parseGraphSummary,
  type GraphMessage,
} from '../../../supabase/functions/_shared/mail/graph-parse';
import {
  GRAPH_UPLOAD_CHUNK,
  buildGraphMessage,
  fitsInlineGraphRequest,
  graphUploadRanges,
  toGraphRecipients,
} from '../../../supabase/functions/_shared/mail/graph-compose';
import {
  buildGraphListUrl,
  isAllowedGraphNextLink,
} from '../../../supabase/functions/_shared/mail/folders';

const message: GraphMessage = {
  id: 'AAMkAG=',
  conversationId: 'conv-1',
  subject: ' Férias de agosto ',
  bodyPreview: 'Olá Rui,\r\n seguem   as férias',
  receivedDateTime: '2026-10-15T09:00:00Z',
  sentDateTime: '2026-10-15T08:59:58Z',
  isRead: false,
  isDraft: false,
  hasAttachments: true,
  flag: { flagStatus: 'flagged' },
  from: { emailAddress: { name: 'Ana Silva', address: 'ana@realize.pt' } },
  toRecipients: [
    { emailAddress: { name: 'rui@realize.pt', address: 'rui@realize.pt' } },
    { emailAddress: { name: 'Marta', address: 'marta@realize.pt' } },
    { emailAddress: { name: 'Sem email', address: '' } },
  ],
  ccRecipients: [{ emailAddress: { name: 'RH', address: 'rh@realize.pt' } }],
  replyTo: [],
  body: { contentType: 'html', content: '<p>Olá <img src="cid:logo"></p>' },
  internetMessageId: '<m1@realize.pt>',
  internetMessageHeaders: [{ name: 'References', value: '<m0@realize.pt>' }],
};

describe('parseGraphSummary', () => {
  it('converte uma mensagem do Graph no resumo da lista', () => {
    expect(parseGraphSummary(message)).toEqual({
      id: 'AAMkAG=',
      thread_id: 'conv-1',
      from: { name: 'Ana Silva', email: 'ana@realize.pt' },
      to: [
        { name: null, email: 'rui@realize.pt' },
        { name: 'Marta', email: 'marta@realize.pt' },
      ],
      subject: 'Férias de agosto',
      snippet: 'Olá Rui, seguem as férias',
      date: '2026-10-15T09:00:00.000Z',
      unread: true,
      starred: true,
      has_attachments: true,
    });
  });

  it('usa o sender sem from, e rascunhos não aparecem como não lidos', () => {
    const summary = parseGraphSummary({
      id: 'd1',
      isDraft: true,
      isRead: false,
      lastModifiedDateTime: '2026-10-14T12:00:00Z',
      sender: { emailAddress: { address: 'eu@realize.pt' } },
      flag: { flagStatus: 'notFlagged' },
    });
    expect(summary.from).toEqual({ name: null, email: 'eu@realize.pt' });
    expect(summary.unread).toBe(false);
    expect(summary.starred).toBe(false);
    expect(summary.date).toBe('2026-10-14T12:00:00.000Z');
    expect(summary.subject).toBe('');
  });

  it('graphRecipient ignora destinatários sem endereço', () => {
    expect(graphRecipient(null)).toBeNull();
    expect(graphRecipient({ emailAddress: { name: 'X' } })).toBeNull();
  });
});

describe('parseGraphMessage', () => {
  const attachments = [
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      id: 'att-logo',
      name: 'logo.png',
      contentType: 'image/png',
      size: 900,
      isInline: true,
    },
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      id: 'att-pdf',
      name: 'Relatório.pdf',
      contentType: 'application/pdf',
      size: 34567,
      isInline: false,
    },
    {
      '@odata.type': '#microsoft.graph.itemAttachment',
      id: 'att-mail',
      name: 'Pedido de férias',
      contentType: null,
      size: 2000,
    },
  ];

  it('corpo HTML, cabeçalhos de resposta e anexos', () => {
    const parsed = parseGraphMessage(message, attachments);
    expect(parsed.html).toBe('<p>Olá <img src="cid:logo"></p>');
    expect(parsed.text).toBeNull();
    expect(parsed.cc).toEqual([{ name: 'RH', email: 'rh@realize.pt' }]);
    expect(parsed.message_id_header).toBe('<m1@realize.pt>');
    expect(parsed.references).toBe('<m0@realize.pt>');
    expect(parsed.attachments).toEqual([
      { id: 'att-logo', filename: 'logo.png', mime: 'image/png', size: 900 },
      { id: 'att-pdf', filename: 'Relatório.pdf', mime: 'application/pdf', size: 34567 },
      { id: 'att-mail', filename: 'Pedido de férias.eml', mime: 'message/rfc822', size: 2000 },
    ]);
  });

  it('esconde as imagens inline já embebidas e aceita o HTML final', () => {
    const parsed = parseGraphMessage(message, attachments, {
      html: '<p>Olá <img src="data:image/png;base64,AAA"></p>',
      excludeAttachmentIds: new Set(['att-logo']),
    });
    expect(parsed.html).toContain('data:image/png');
    expect(parsed.attachments.map(a => a.id)).toEqual(['att-pdf', 'att-mail']);
  });

  it('corpo em texto simples', () => {
    const parsed = parseGraphMessage({
      ...message,
      hasAttachments: false,
      body: { contentType: 'text', content: 'Olá' },
    });
    expect(parsed.text).toBe('Olá');
    expect(parsed.html).toBeNull();
    expect(parsed.has_attachments).toBe(false);
  });

  it('graphAttachmentInfo dá nomes por omissão', () => {
    expect(graphAttachmentInfo({ id: 'x' })).toEqual({
      id: 'x',
      filename: 'anexo',
      mime: 'application/octet-stream',
      size: 0,
    });
  });
});

describe('listagem no Graph', () => {
  it('pastas conhecidas com $select, $top e ordem por data', () => {
    const { url, postFilterFlagged } = buildGraphListUrl('sent', { query: null, limit: 25 });
    expect(
      url.startsWith('https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?')
    ).toBe(true);
    expect(url).toContain('$top=25');
    expect(url).toContain('$select=id,conversationId,subject');
    expect(url).toContain('$orderby=receivedDateTime%20desc');
    expect(postFilterFlagged).toBe(false);
  });

  it('marcadas: todas as mensagens com $filter que começa pela propriedade do $orderby', () => {
    const { url } = buildGraphListUrl('starred', { query: null, limit: 10 });
    expect(url.startsWith('https://graph.microsoft.com/v1.0/me/messages?')).toBe(true);
    const filter = decodeURIComponent(/\$filter=([^&]+)/.exec(url)?.[1] ?? '');
    expect(filter).toBe(
      "receivedDateTime ge 1900-01-01T00:00:00Z and flag/flagStatus eq 'flagged'"
    );
  });

  it('pesquisa usa $search sem $orderby e limpa aspas', () => {
    const { url, postFilterFlagged } = buildGraphListUrl('inbox', {
      query: 'fatura "abril"',
      limit: 25,
    });
    expect(url).not.toContain('$orderby');
    expect(decodeURIComponent(/\$search=([^&]+)/.exec(url)?.[1] ?? '')).toBe('"fatura abril"');
    expect(postFilterFlagged).toBe(false);
    expect(buildGraphListUrl('starred', { query: 'x', limit: 25 }).postFilterFlagged).toBe(true);
  });

  it('pastas sem equivalente direto', () => {
    expect(buildGraphListUrl('spam', { query: null, limit: 5 }).url).toContain(
      '/mailFolders/junkemail/'
    );
    expect(buildGraphListUrl('trash', { query: null, limit: 5 }).url).toContain(
      '/mailFolders/deleteditems/'
    );
    expect(buildGraphListUrl('archive', { query: null, limit: 5 }).url).toContain(
      '/mailFolders/archive/'
    );
  });

  it('só aceita page_token do próprio Graph', () => {
    expect(isAllowedGraphNextLink('https://graph.microsoft.com/v1.0/me/messages?$skip=25')).toBe(
      true
    );
    expect(isAllowedGraphNextLink('https://evil.example/graph.microsoft.com/')).toBe(false);
    expect(isAllowedGraphNextLink('https://graph.microsoft.com.evil.pt/x')).toBe(false);
  });
});

describe('envio pelo Graph', () => {
  it('monta a mensagem com destinatários e anexos', () => {
    const payload = buildGraphMessage({
      subject: 'Olá',
      html: '<p>Olá</p>',
      to: [{ name: 'Rui', email: 'rui@realize.pt' }],
      cc: [],
      bcc: [{ name: null, email: 'rh@realize.pt' }],
      attachments: [{ filename: 'a.txt', mime: 'text/plain', base64: 'b2zDoQ==' }],
    });
    expect(payload).toEqual({
      subject: 'Olá',
      body: { contentType: 'HTML', content: '<p>Olá</p>' },
      toRecipients: [{ emailAddress: { address: 'rui@realize.pt', name: 'Rui' } }],
      ccRecipients: [],
      bccRecipients: [{ emailAddress: { address: 'rh@realize.pt' } }],
      attachments: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: 'a.txt',
          contentType: 'text/plain',
          contentBytes: 'b2zDoQ==',
        },
      ],
    });
    expect(toGraphRecipients([])).toEqual([]);
  });

  it('sem HTML envia o texto', () => {
    const payload = buildGraphMessage({
      subject: '',
      html: ' ',
      text: 'Olá',
      to: [],
      cc: [],
      bcc: [],
    });
    expect(payload.body).toEqual({ contentType: 'Text', content: 'Olá' });
    expect(payload).not.toHaveProperty('attachments');
  });

  it('decide entre um pedido só e a sessão de upload', () => {
    const small = [{ filename: 'a', mime: 'text/plain', base64: 'A'.repeat(1000) }];
    const big = [{ filename: 'b', mime: 'text/plain', base64: 'A'.repeat(4 * 1024 * 1024) }];
    expect(fitsInlineGraphRequest(small)).toBe(true);
    expect(fitsInlineGraphRequest(big)).toBe(false);
    expect(fitsInlineGraphRequest(small, 3 * 1024 * 1024)).toBe(false);
  });

  it('parte o upload em pedaços múltiplos de 320 KiB', () => {
    expect(GRAPH_UPLOAD_CHUNK % (320 * 1024)).toBe(0);
    const total = GRAPH_UPLOAD_CHUNK * 2 + 10;
    expect(graphUploadRanges(total)).toEqual([
      { start: 0, end: GRAPH_UPLOAD_CHUNK - 1 },
      { start: GRAPH_UPLOAD_CHUNK, end: GRAPH_UPLOAD_CHUNK * 2 - 1 },
      { start: GRAPH_UPLOAD_CHUNK * 2, end: total - 1 },
    ]);
  });
});
