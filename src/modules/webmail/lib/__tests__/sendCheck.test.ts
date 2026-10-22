import { describe, expect, it } from 'vitest';
import { checkBeforeSend } from '../sendCheck';

const base = {
  to: ['ana@x.pt'],
  cc: [] as string[],
  bcc: [] as string[],
  subject: 'Olá',
  written: 'Bom dia',
  attachments: 0,
};

describe('checkBeforeSend', () => {
  it('lets a complete email go without asking', () => {
    expect(checkBeforeSend(base)).toEqual({ blocked: false, missing: [] });
  });

  it('blocks when there is nobody to send to', () => {
    expect(checkBeforeSend({ ...base, to: [] }).blocked).toBe(true);
  });

  it('asks about a missing subject, text, or an empty "Para"', () => {
    expect(checkBeforeSend({ ...base, subject: ' ' }).missing).toEqual(['assunto']);
    expect(checkBeforeSend({ ...base, written: '' }).missing).toEqual(['texto da mensagem']);
    expect(checkBeforeSend({ ...base, written: '', attachments: 1 }).missing).toEqual([]);
    expect(checkBeforeSend({ ...base, to: [], cc: ['rui@x.pt'] })).toEqual({
      blocked: false,
      missing: ['ninguém no campo "Para" (só Cc/Bcc)'],
    });
  });
});
