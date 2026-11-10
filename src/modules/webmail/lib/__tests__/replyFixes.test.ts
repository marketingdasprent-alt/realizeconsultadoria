import { describe, expect, it } from 'vitest';
import type { MailMessage } from '../../types';
import { draftFrom, linkifyHtml } from '../mailFormat';

const base: MailMessage = {
  id: 'm1',
  accountId: 'a1',
  threadId: 't1',
  from: { name: 'Ana', email: 'ana@x.pt' },
  to: [{ name: null, email: 'eu@x.pt' }],
  cc: [],
  replyTo: [],
  subject: 'Orçamento',
  snippet: '',
  date: new Date(2026, 10, 10, 9, 0).toISOString(),
  unread: false,
  starred: false,
  hasAttachments: false,
  html: null,
  text: 'Olá',
  attachments: [],
};

describe('respostas', () => {
  it('responder a um email meu (Enviados) vai para quem o recebeu', () => {
    const mine: MailMessage = {
      ...base,
      from: { name: 'Eu', email: 'EU@x.pt' },
      to: [{ name: 'Cliente', email: 'cliente@y.pt' }],
      cc: [{ name: null, email: 'chefe@x.pt' }],
    };
    expect(draftFrom(mine, 'reply', 'eu@x.pt').to).toBe('Cliente <cliente@y.pt>');
    const all = draftFrom(mine, 'replyAll', 'eu@x.pt');
    expect(all.to).toBe('Cliente <cliente@y.pt>');
    expect(all.cc).toBe('chefe@x.pt');
  });

  it('responder a todos sem repetidos nem o meu endereço (maiúsculas não contam)', () => {
    const m: MailMessage = {
      ...base,
      to: [
        { name: null, email: 'Eu@X.pt' },
        { name: null, email: 'rui@x.pt' },
      ],
      cc: [
        { name: null, email: 'RUI@x.pt' },
        { name: null, email: 'ANA@x.pt' },
      ],
    };
    const all = draftFrom(m, 'replyAll', 'eu@x.pt');
    expect(all.to).toBe('Ana <ana@x.pt>');
    expect(all.cc).toBe('rui@x.pt');
  });

  it('prefixos do Outlook em português não se acumulam', () => {
    expect(draftFrom({ ...base, subject: 'RES: x' }, 'reply', '').subject).toBe('Re: x');
    expect(draftFrom({ ...base, subject: 'Re: RES: x' }, 'reply', '').subject).toBe('Re: x');
    expect(draftFrom({ ...base, subject: 'Enc: x' }, 'forward', '').subject).toBe('Fwd: x');
    expect(draftFrom({ ...base, subject: 'FW: x' }, 'forward', '').subject).toBe('Fwd: x');
    expect(draftFrom({ ...base, subject: 'Re: x' }, 'forward', '').subject).toBe('Fwd: Re: x');
  });
});

describe('ligações no texto', () => {
  it('aspas e <> à volta do endereço não entram na ligação', () => {
    expect(linkifyHtml('&quot;https://x.pt&quot;')).toContain('href="https://x.pt"');
    expect(linkifyHtml('&lt;https://x.pt/a&gt;')).toContain('href="https://x.pt/a"');
  });
  it('&amp; da query fica na ligação', () => {
    expect(linkifyHtml('https://x.pt/?a=1&amp;b=2')).toContain('href="https://x.pt/?a=1&amp;b=2"');
  });
});
