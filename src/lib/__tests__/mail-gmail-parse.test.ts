// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  findGmailPart,
  listGmailAttachments,
  listGmailInlineParts,
  parseGmailMessage,
  parseGmailSummary,
  pickGmailBodyParts,
  type GmailMessage,
} from '../../../supabase/functions/_shared/mail/gmail-parse';
import {
  GMAIL_FOLDER_QUERY,
  gmailListQuery,
} from '../../../supabase/functions/_shared/mail/folders';
import { encodeHeaderValue } from '../../../supabase/functions/_shared/mail/mime';

const b64url = (text: string, encoding: BufferEncoding = 'utf8') =>
  Buffer.from(text, encoding).toString('base64url');

const RECEIVED = Date.UTC(2026, 9, 15, 9, 0);

const headers = [
  { name: 'From', value: '"Silva, Ana" <ana@realize.pt>' },
  { name: 'To', value: 'rui@realize.pt, Marta <marta@realize.pt>' },
  { name: 'Cc', value: 'rh@realize.pt' },
  { name: 'Reply-To', value: 'Equipa RH <rh@realize.pt>' },
  { name: 'Subject', value: encodeHeaderValue('Férias de agosto') },
  { name: 'Date', value: 'Thu, 15 Oct 2026 10:00:00 +0100' },
  { name: 'Message-Id', value: '<m1@realize.pt>' },
  { name: 'References', value: '<m0@realize.pt>' },
];

const metadata: GmailMessage = {
  id: '18c1',
  threadId: 't1',
  labelIds: ['INBOX', 'UNREAD', 'STARRED'],
  snippet: 'Olá Rui &amp; equipa, seguem as &quot;férias&quot;',
  internalDate: String(RECEIVED),
  payload: { mimeType: 'multipart/mixed', headers },
};

const full: GmailMessage = {
  ...metadata,
  payload: {
    partId: '',
    mimeType: 'multipart/mixed',
    filename: '',
    headers,
    body: { size: 0 },
    parts: [
      {
        partId: '0',
        mimeType: 'multipart/related',
        filename: '',
        parts: [
          {
            partId: '0.0',
            mimeType: 'multipart/alternative',
            filename: '',
            parts: [
              {
                partId: '0.0.0',
                mimeType: 'text/plain',
                filename: '',
                headers: [{ name: 'Content-Type', value: 'text/plain; charset="ISO-8859-1"' }],
                body: { size: 8, data: b64url('Olá João', 'latin1') },
              },
              {
                partId: '0.0.1',
                mimeType: 'text/html',
                filename: '',
                headers: [{ name: 'Content-Type', value: 'text/html; charset=UTF-8' }],
                body: { size: 40, data: b64url('<p>Olá João <img src="cid:logo@x"></p>') },
              },
            ],
          },
          {
            partId: '0.1',
            mimeType: 'image/png',
            filename: 'logo.png',
            headers: [
              { name: 'Content-ID', value: '<logo@x>' },
              { name: 'Content-Disposition', value: 'inline; filename="logo.png"' },
            ],
            body: { attachmentId: 'ANGjdJ_logo', size: 1200 },
          },
        ],
      },
      {
        partId: '1',
        mimeType: 'application/pdf',
        filename: 'Relatório.pdf',
        headers: [{ name: 'Content-Disposition', value: 'attachment' }],
        body: { attachmentId: 'ANGjdJ_pdf', size: 34567 },
      },
    ],
  },
};

describe('parseGmailSummary', () => {
  it('converte o formato metadata no resumo da lista', () => {
    expect(parseGmailSummary(metadata)).toEqual({
      id: '18c1',
      thread_id: 't1',
      from: { name: 'Silva, Ana', email: 'ana@realize.pt' },
      to: [
        { name: null, email: 'rui@realize.pt' },
        { name: 'Marta', email: 'marta@realize.pt' },
      ],
      subject: 'Férias de agosto',
      snippet: 'Olá Rui & equipa, seguem as "férias"',
      date: new Date(RECEIVED).toISOString(),
      unread: true,
      starred: true,
      has_attachments: true,
    });
  });

  it('usa o cabeçalho Date quando não há internalDate e tolera campos em falta', () => {
    const summary = parseGmailSummary({
      id: 'x',
      payload: { mimeType: 'text/plain', headers: [{ name: 'Date', value: headers[5].value }] },
    });
    expect(summary.date).toBe('2026-10-15T09:00:00.000Z');
    expect(summary).toMatchObject({
      from: null,
      to: [],
      subject: '',
      unread: false,
      starred: false,
      has_attachments: false,
      thread_id: null,
    });
  });
});

describe('parseGmailMessage (format=full)', () => {
  it('escolhe o HTML e o texto certos e respeita o charset de cada parte', () => {
    const bodies = pickGmailBodyParts(full.payload);
    expect(bodies.html?.partId).toBe('0.0.1');
    expect(bodies.text?.partId).toBe('0.0.0');

    const message = parseGmailMessage(full);
    expect(message.html).toBe('<p>Olá João <img src="cid:logo@x"></p>');
    expect(message.text).toBe('Olá João');
    expect(message.cc).toEqual([{ name: null, email: 'rh@realize.pt' }]);
    expect(message.reply_to).toEqual([{ name: 'Equipa RH', email: 'rh@realize.pt' }]);
    expect(message.message_id_header).toBe('<m1@realize.pt>');
    expect(message.references).toBe('<m0@realize.pt>');
  });

  it('lista anexos com id = partId e esconde imagens inline já embebidas', () => {
    expect(listGmailAttachments(full.payload)).toEqual([
      { id: '0.1', filename: 'logo.png', mime: 'image/png', size: 1200 },
      { id: '1', filename: 'Relatório.pdf', mime: 'application/pdf', size: 34567 },
    ]);
    const message = parseGmailMessage(full, {
      html: '<p>com data:</p>',
      excludePartIds: new Set(['0.1']),
    });
    expect(message.html).toBe('<p>com data:</p>');
    expect(message.attachments.map(a => a.id)).toEqual(['1']);
    expect(message.has_attachments).toBe(true);
  });

  it('encontra imagens inline pelo Content-ID e partes pelo partId', () => {
    expect(listGmailInlineParts(full.payload)).toEqual([
      {
        partId: '0.1',
        contentId: 'logo@x',
        mime: 'image/png',
        size: 1200,
        data: null,
        attachmentId: 'ANGjdJ_logo',
      },
    ]);
    expect(findGmailPart(full.payload, '1')?.filename).toBe('Relatório.pdf');
    expect(findGmailPart(full.payload, '9')).toBeNull();
  });

  it('mensagem sem multipart: o corpo está na própria raiz', () => {
    const message = parseGmailMessage({
      id: 's1',
      payload: {
        partId: '',
        mimeType: 'text/plain',
        headers: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }],
        body: { size: 5, data: b64url('Olá!') },
      },
    });
    expect(message.text).toBe('Olá!');
    expect(message.html).toBeNull();
    expect(message.attachments).toEqual([]);
    expect(message.has_attachments).toBe(false);
  });

  it('corpo grande só com attachmentId fica null até ser obtido à parte', () => {
    const message = parseGmailMessage({
      id: 'g1',
      payload: {
        partId: '',
        mimeType: 'text/html',
        body: { size: 900_000, attachmentId: 'BIG' },
      },
    });
    expect(message.html).toBeNull();
  });
});

describe('pastas Gmail', () => {
  it('traduz pastas em pesquisas e junta a pesquisa do utilizador', () => {
    expect(gmailListQuery('inbox', null)).toEqual({ q: 'in:inbox', includeSpamTrash: false });
    expect(gmailListQuery('trash', 'fatura')).toEqual({
      q: 'in:trash fatura',
      includeSpamTrash: true,
    });
    expect(gmailListQuery('spam', '  ').includeSpamTrash).toBe(true);
    expect(gmailListQuery('starred', 'from:ana').q).toBe('is:starred from:ana');
    expect(GMAIL_FOLDER_QUERY.archive).toBe(
      '-in:inbox -in:sent -in:drafts -in:trash -in:spam -in:chats'
    );
  });
});
