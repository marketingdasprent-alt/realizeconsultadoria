// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  decodeImapMessageId,
  encodeImapMessageId,
  resolveImapFolder,
} from '../../../supabase/functions/_shared/mail/folders';
import {
  imapHasAttachments,
  imapSnippet,
  imapSummary,
  parsedMailToMessage,
  pickImapSnippetPart,
  type ImapBodyNode,
} from '../../../supabase/functions/_shared/mail/imap-parse';

const structure: ImapBodyNode = {
  type: 'multipart/mixed',
  childNodes: [
    {
      part: '1',
      type: 'multipart/alternative',
      childNodes: [
        {
          part: '1.1',
          type: 'text/plain',
          parameters: { charset: 'iso-8859-1' },
          encoding: 'quoted-printable',
          size: 120,
        },
        { part: '1.2', type: 'text/html', encoding: 'base64', size: 400 },
      ],
    },
    {
      part: '2',
      type: 'application/pdf',
      disposition: 'attachment',
      dispositionParameters: { filename: 'fatura.pdf' },
      encoding: 'base64',
      size: 5000,
    },
  ],
};

describe('pastas IMAP', () => {
  const mailboxes = [
    { path: 'INBOX', name: 'INBOX', delimiter: '/' },
    { path: '[Gmail]/Enviados', name: 'Enviados', specialUse: '\\Sent', delimiter: '/' },
    { path: 'INBOX.Trash', name: 'Trash', delimiter: '.' },
    { path: 'Junk', name: 'Junk', delimiter: '/' },
  ];

  it('usa special-use e, sem ele, nomes habituais', () => {
    expect(resolveImapFolder('inbox', mailboxes)).toBe('INBOX');
    expect(resolveImapFolder('sent', mailboxes)).toBe('[Gmail]/Enviados');
    expect(resolveImapFolder('trash', mailboxes)).toBe('INBOX.Trash');
    expect(resolveImapFolder('spam', mailboxes)).toBe('Junk');
    expect(resolveImapFolder('archive', mailboxes)).toBeNull();
    expect(resolveImapFolder('starred', mailboxes)).toBeNull();
  });

  it('ids "<pasta>:<uid>" seguros mesmo com ":" e "/" no nome da pasta', () => {
    const id = encodeImapMessageId('Projetos: 2026/Clientes', 42);
    expect(id.split(':')).toHaveLength(2);
    expect(decodeImapMessageId(id)).toEqual({ path: 'Projetos: 2026/Clientes', uid: 42 });
    expect(decodeImapMessageId('INBOX:0')).toBeNull();
    expect(decodeImapMessageId('INBOX:abc')).toBeNull();
    expect(decodeImapMessageId('semuid')).toBeNull();
    expect(decodeImapMessageId('%E0%A4%A:3')).toBeNull();
  });
});

describe('BODYSTRUCTURE', () => {
  it('deteta anexos e escolhe a parte de texto para a pré-visualização', () => {
    expect(imapHasAttachments(structure)).toBe(true);
    expect(imapHasAttachments({ type: 'text/plain' })).toBe(false);
    expect(pickImapSnippetPart(structure)).toEqual({
      part: '1.1',
      encoding: 'quoted-printable',
      charset: 'iso-8859-1',
      html: false,
      size: 120,
    });
    expect(pickImapSnippetPart({ type: 'text/html', encoding: '7bit' })?.part).toBe('1');
  });

  it('descodifica quoted-printable/base64 e o charset na pré-visualização', () => {
    const qp = new TextEncoder().encode('Ol=E1 Jo=E3o,=\r\n tudo bem?');
    expect(
      imapSnippet(qp, {
        part: '1',
        encoding: 'quoted-printable',
        charset: 'iso-8859-1',
        html: false,
        size: 0,
      })
    ).toBe('Olá João, tudo bem?');
    const html = new TextEncoder().encode(
      Buffer.from('<p>Olá&nbsp;<b>Rui</b></p>', 'utf8').toString('base64')
    );
    expect(
      imapSnippet(html, { part: '1', encoding: 'base64', charset: null, html: true, size: 0 })
    ).toBe('Olá Rui');
  });
});

describe('mensagens IMAP', () => {
  it('resumo a partir de envelope e flags', () => {
    const summary = imapSummary({
      id: 'INBOX:7',
      envelope: {
        date: new Date('2026-10-15T09:00:00Z'),
        subject: 'Fatura',
        from: [{ name: 'Ana', address: 'ana@realize.pt' }],
        to: [{ address: 'rui@realize.pt' }],
      },
      flags: new Set(['\\Flagged']),
      bodyStructure: structure,
      snippet: 'Olá',
    });
    expect(summary).toEqual({
      id: 'INBOX:7',
      thread_id: null,
      from: { name: 'Ana', email: 'ana@realize.pt' },
      to: [{ name: null, email: 'rui@realize.pt' }],
      subject: 'Fatura',
      snippet: 'Olá',
      date: '2026-10-15T09:00:00.000Z',
      unread: true,
      starred: true,
      has_attachments: true,
    });
  });

  it('mensagem completa do mailparser (anexos visíveis com id = índice)', () => {
    const message = parsedMailToMessage(
      {
        subject: 'Fatura',
        from: { value: [{ name: 'Ana', address: 'ana@realize.pt' }] },
        to: [
          { value: [{ address: 'rui@realize.pt' }] },
          { value: [{ group: [{ address: 'b@x.pt' }] }] },
        ],
        cc: { value: [{ name: 'RH', address: 'rh@realize.pt' }] },
        date: new Date('2026-10-15T09:00:00Z'),
        html: '<p>Olá <img src="data:image/png;base64,AAA"></p>',
        text: 'Olá',
        attachments: [
          { filename: 'logo.png', contentType: 'image/png', size: 10, related: true },
          { filename: 'fatura.pdf', contentType: 'application/pdf', size: 5000 },
        ],
        messageId: '<m1@realize.pt>',
        references: ['<a@x>', '<b@x>'],
      },
      { id: 'INBOX:7', flags: ['\\Seen'] }
    );
    expect(message.to.map(a => a.email)).toEqual(['rui@realize.pt', 'b@x.pt']);
    expect(message.cc).toEqual([{ name: 'RH', email: 'rh@realize.pt' }]);
    expect(message.attachments).toEqual([
      { id: '1', filename: 'fatura.pdf', mime: 'application/pdf', size: 5000 },
    ]);
    expect(message.unread).toBe(false);
    expect(message.references).toBe('<a@x> <b@x>');
    expect(message.snippet).toBe('Olá');
    expect(message.html).toContain('data:image/png');
  });
});
