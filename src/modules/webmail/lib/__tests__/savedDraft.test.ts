import { describe, expect, it } from 'vitest';
import type { MailMessage } from '../../types';
import { draftFromSaved, draftHasContent } from '../savedDraft';

const saved: MailMessage = {
  id: 'd1',
  accountId: 'a1',
  threadId: null,
  from: { name: null, email: 'eu@x.pt' },
  to: [
    { name: 'Ana', email: 'ana@x.pt' },
    { name: null, email: 'rui@x.pt' },
  ],
  cc: [{ name: null, email: 'chefe@x.pt' }],
  replyTo: [],
  subject: 'Proposta',
  snippet: '',
  date: new Date(2026, 9, 22).toISOString(),
  unread: false,
  starred: false,
  hasAttachments: true,
  html: '<p>Olá Ana,</p><p>segue a proposta.</p>',
  text: null,
  attachments: [{ id: '0', filename: 'proposta.pdf', mime: 'application/pdf', size: 10 }],
};

describe('rascunhos', () => {
  it('reopens a saved draft with recipients, subject, text and attachments', () => {
    const draft = draftFromSaved(saved);
    expect(draft.to).toBe('ana@x.pt, rui@x.pt');
    expect(draft.cc).toBe('chefe@x.pt');
    expect(draft.subject).toBe('Proposta');
    expect(draft.body).toContain('segue a proposta');
    expect(draft.saved).toEqual({
      messageId: 'd1',
      accountId: 'a1',
      attachments: saved.attachments,
    });
  });

  it('only saves when there is something to keep', () => {
    const empty = { to: '', cc: '', bcc: '', subject: '', body: '  ' };
    expect(draftHasContent(empty, 0)).toBe(false);
    expect(draftHasContent(empty, 1)).toBe(true);
    expect(draftHasContent({ ...empty, subject: 'Olá' }, 0)).toBe(true);
  });
});
