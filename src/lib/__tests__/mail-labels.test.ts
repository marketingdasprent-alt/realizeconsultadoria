// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { labelKeyOf, messageKey } from '../../../supabase/functions/_shared/mail/labels';

describe('chave dos marcadores', () => {
  it('Message-ID sem <> e em minúsculas', () => {
    expect(messageKey('<ABC.123@Mail.Exemplo.PT>')).toBe('abc.123@mail.exemplo.pt');
    expect(messageKey('  <x@y>  ')).toBe('x@y');
  });

  it('sem Message-ID não há chave', () => {
    expect(messageKey(null)).toBeNull();
    expect(messageKey('')).toBeNull();
    expect(messageKey('<>')).toBeNull();
  });

  it('o mesmo email dá a mesma chave mesmo mudando de id (UID) ao mudar de pasta', () => {
    const before = labelKeyOf({ id: 'INBOX|101', message_key: messageKey('<A@B>') });
    const after = labelKeyOf({ id: 'INBOX.Tratados|7', message_key: messageKey('<a@b>') });
    expect(before).toBe(after);
  });

  it('sem Message-ID usa o id do fornecedor', () => {
    expect(labelKeyOf({ id: 'xyz', message_key: null })).toBe('id:xyz');
  });
});
