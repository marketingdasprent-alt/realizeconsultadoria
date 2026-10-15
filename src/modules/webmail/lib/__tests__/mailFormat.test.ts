import { describe, expect, it } from 'vitest';
import type { MailMessage } from '../../types';
import {
  draftFrom,
  formatMailDate,
  htmlToText,
  parseRecipients,
  readerDocument,
  textToHtml,
  withSignature,
} from '../mailFormat';

const message: MailMessage = {
  id: 'm1',
  accountId: 'a1',
  threadId: 't1',
  from: { name: 'Ana Ferreira', email: 'ana@exemplo.pt' },
  to: [
    { name: 'Joana', email: 'joana@exemplo.pt' },
    { name: null, email: 'rui@exemplo.pt' },
  ],
  cc: [{ name: 'Marta', email: 'marta@exemplo.pt' }],
  replyTo: [],
  subject: 'Plano de férias',
  snippet: '',
  date: new Date(2026, 9, 14, 9, 30).toISOString(),
  unread: false,
  starred: false,
  hasAttachments: false,
  html: null,
  text: 'Olá!\nSegue o plano.',
  attachments: [],
};

describe('webmail', () => {
  it('datas curtas na lista', () => {
    const now = new Date(2026, 9, 15, 12);
    expect(formatMailDate(new Date(2026, 9, 3, 8).toISOString(), now)).toBe('3 out');
    expect(formatMailDate(new Date(2025, 2, 3, 8).toISOString(), now)).toBe('03/03/25');
  });

  it('lê destinatários escritos à mão', () => {
    expect(parseRecipients('a@b.pt; Ana <ana@x.pt>, inválido, ')).toEqual(['a@b.pt', 'ana@x.pt']);
  });

  it('responder a todos tira o próprio e cita a mensagem', () => {
    const draft = draftFrom(message, 'replyAll', 'JOANA@exemplo.pt');
    expect(draft.to).toBe('Ana Ferreira <ana@exemplo.pt>');
    expect(draft.cc).toBe('rui@exemplo.pt, Marta <marta@exemplo.pt>');
    expect(draft.subject).toBe('Re: Plano de férias');
    expect(draft.inReplyTo).toBe('m1');
    expect(draft.body).toContain('> Segue o plano.');
    expect(draftFrom({ ...message, subject: 'RE: x' }, 'reply', '').subject).toBe('RE: x');
  });

  it('reencaminhar não tem destinatários', () => {
    const draft = draftFrom(message, 'forward', 'joana@exemplo.pt');
    expect(draft.to).toBeUndefined();
    expect(draft.subject).toBe('Fwd: Plano de férias');
  });

  it('assinatura antes da citação', () => {
    expect(withSignature('\n\n> citação', 'Joana\nRH')).toBe('\n\n--\nJoana\nRH\n\n> citação');
    expect(withSignature('corpo', '  ')).toBe('corpo');
  });

  it('HTML ↔ texto', () => {
    expect(htmlToText('<p>Olá&nbsp;<b>Ana</b></p><script>x()</script>linha<br>2')).toBe(
      'Olá Ana\nlinha\n2'
    );
    expect(textToHtml('a < b\n> citado')).toContain('a &lt; b<br><span');
  });

  it('o leitor tira scripts e abre ligações fora', () => {
    const doc = readerDocument({ html: '<p>Oi</p><script>alert(1)</script>', text: null });
    expect(doc).not.toContain('alert');
    expect(doc).toContain('<base target="_blank">');
    expect(readerDocument({ html: null, text: '<b>' })).toContain('&lt;b&gt;');
  });
});
