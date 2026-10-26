import { describe, expect, it } from 'vitest';
import type { MailMessage } from '../../types';
import { mimeFromName, previewKind } from '../attachments';
import { FORWARD_MARKER, forwardedHtml, forwardedText, stripActiveHtml } from '../forward';
import { draftFrom, readerDocument } from '../mailFormat';
import { composeWithSignature } from '../signature';

const message: MailMessage = {
  id: 'm1',
  accountId: 'a1',
  threadId: 't1',
  from: { name: 'Ana Ferreira', email: 'ana@exemplo.pt' },
  to: [{ name: 'Joana', email: 'joana@exemplo.pt' }],
  cc: [],
  replyTo: [],
  subject: 'Fatura de outubro',
  snippet: '',
  date: new Date(2026, 9, 14, 9, 30).toISOString(),
  unread: false,
  starred: false,
  hasAttachments: true,
  html: '<p>Segue a fatura.</p><script>x()</script><a href="javascript:x()" onclick="y()">ver</a>',
  text: 'Segue a fatura.',
  attachments: [{ id: '0', filename: 'fatura.pdf', mime: 'application/pdf', size: 1000 }],
};

describe('forward', () => {
  it('keeps the whole original email: header, HTML body and attachments', () => {
    const draft = draftFrom(message, 'forward', 'joana@exemplo.pt');
    expect(draft.subject).toBe('Fwd: Fatura de outubro');
    expect(draft.body).toContain(FORWARD_MARKER);
    expect(draft.body).toContain('Assunto: Fatura de outubro');
    expect(draft.body).toContain('Segue a fatura.');
    expect(draft.forward?.attachments).toHaveLength(1);
    expect(draft.forward?.messageId).toBe('m1');
    expect(draft.forward?.html).toContain('Segue a fatura.');
  });

  it('strips what can run code from the original HTML', () => {
    const html = forwardedHtml(message);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(stripActiveHtml('<iframe src="x"></iframe><b>ok</b>')).toBe('<b>ok</b>');
  });

  it('puts the signature before the forwarded email, in HTML and text', () => {
    const text = `Olá!${forwardedText(message, 'Segue a fatura.')}`;
    const { html, text: plain } = composeWithSignature(
      text,
      '<b>Thiago</b>',
      forwardedHtml(message)
    );
    expect(html.indexOf('Thiago')).toBeLessThan(html.indexOf(FORWARD_MARKER));
    expect(html).toContain('Segue a fatura.');
    expect(plain.indexOf('Thiago')).toBeLessThan(plain.indexOf(FORWARD_MARKER));
  });

  it('still works without signature, and plain replies are unchanged', () => {
    const text = `Olá!${forwardedText(message, 'corpo')}`;
    const { html } = composeWithSignature(text, null, '<div>ORIGINAL</div>');
    expect(html).toContain('ORIGINAL');
    expect(composeWithSignature('Olá', null).text).toBe('Olá');
  });
});

describe('previewKind', () => {
  it('previews what is safe to show and downloads the rest', () => {
    expect(previewKind('image/png', 'a.png')).toBe('image');
    expect(previewKind('application/pdf', 'x')).toBe('pdf');
    expect(previewKind('application/octet-stream', 'faturas.PDF')).toBe('pdf');
    expect(previewKind('text/csv', 'a.csv')).toBe('text');
    expect(previewKind('image/svg+xml', 'a.svg')).toBeNull();
    expect(previewKind('application/zip', 'a.zip')).toBeNull();
  });
});

describe('attachments sent as octet-stream', () => {
  it('previews by extension and fixes the type', () => {
    expect(previewKind('application/octet-stream', 'QR_893510.PNG')).toBe('image');
    expect(mimeFromName('application/octet-stream', 'QR.png')).toBe('image/png');
    expect(mimeFromName('application/octet-stream', 'dados.bin')).toBe('application/octet-stream');
    expect(mimeFromName('image/jpeg', 'foto.png')).toBe('image/jpeg');
  });
});

describe('readerDocument', () => {
  it('lets the email grow past its own height:100% (text was cut off)', () => {
    const doc = readerDocument({
      html: '<style>html,body{height:100%}</style><p>Olá</p>',
      text: null,
    });
    expect(doc.lastIndexOf('height:auto!important')).toBeGreaterThan(doc.indexOf('<p>Olá</p>'));
  });
});
