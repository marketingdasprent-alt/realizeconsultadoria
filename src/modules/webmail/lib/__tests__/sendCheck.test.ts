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
    expect(checkBeforeSend(base)).toEqual({
      blocked: false,
      missing: [],
      invalid: [],
      warnings: [],
    });
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
      invalid: [],
      warnings: [],
    });
  });

  it('flags text left in a recipient field that is not an email', () => {
    const unparsed = [
      { label: 'Para', text: '' },
      { label: 'Cc', text: 'rui@x ' },
    ];
    expect(checkBeforeSend({ ...base, unparsed }).invalid).toEqual(['"rui@x" (Cc)']);
  });
});

describe('checkBeforeSend: avisos', () => {
  const base = { to: ['a@cliente.pt'], cc: [], bcc: [], subject: 'Proposta', attachments: 0 };

  it('fala em anexo sem anexo', () => {
    const r = checkBeforeSend({ ...base, written: 'Bom dia, segue em anexo a proposta.' });
    expect(r.warnings[0]).toMatch(/fala num anexo/);
    expect(
      checkBeforeSend({ ...base, attachments: 1, written: 'Segue em anexo.' }).warnings
    ).toEqual([]);
  });

  it('domínio mal escrito', () => {
    const r = checkBeforeSend({
      ...base,
      to: ['joao@gmial.com', 'ana@empresa.con'],
      written: 'Olá',
    });
    expect(r.warnings).toEqual([
      '"joao@gmial.com" — queria dizer @gmail.com?',
      '"ana@empresa.con" — queria dizer @empresa.com?',
    ]);
  });

  it('sem avisos num email normal', () => {
    expect(checkBeforeSend({ ...base, written: 'Obrigado pela reunião.' }).warnings).toEqual([]);
  });
});
