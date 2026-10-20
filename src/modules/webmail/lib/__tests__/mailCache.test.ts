import { afterEach, describe, expect, it } from 'vitest';
import {
  patchListCaches,
  readListCache,
  readMailboxCache,
  writeListCache,
  writeMailboxCache,
} from '../mailCache';

type Page = { messages: { id: string; accountId: string; unread?: boolean }[] };

describe('listas de email guardadas no browser', () => {
  afterEach(() => localStorage.clear());

  it('um email apagado sai de todas as listas guardadas', () => {
    const mail = { id: 'm1', accountId: 'a1' };
    writeListCache<Page>('u1', 'all|inbox|a1,a2', {
      messages: [mail, { id: 'm2', accountId: 'a2' }],
    });
    writeListCache<Page>('u1', 'a1|inbox|a1', { messages: [mail] });
    writeListCache<Page>('u2', 'a1|inbox|a1', { messages: [mail] });

    patchListCaches('u1', mail, 'remove');

    expect(readListCache<Page>('u1', 'all|inbox|a1,a2')?.page.messages.map(m => m.id)).toEqual([
      'm2',
    ]);
    expect(readListCache<Page>('u1', 'a1|inbox|a1')?.page.messages).toEqual([]);
    // de outro utilizador neste browser: não mexe
    expect(readListCache<Page>('u2', 'a1|inbox|a1')?.page.messages).toHaveLength(1);
  });

  it('marcar como lido também fica guardado', () => {
    writeListCache<Page>('u1', 'k', { messages: [{ id: 'm1', accountId: 'a1', unread: true }] });
    patchListCaches('u1', { id: 'm1', accountId: 'a1' }, { unread: false });
    expect(readListCache<Page>('u1', 'k')?.page.messages[0].unread).toBe(false);
  });
});

describe('lista guardada por caixa', () => {
  afterEach(() => localStorage.clear());

  it('"Todas as caixas" junta a lista de cada caixa, sem depender da ordem', () => {
    const mail = (id: string, accountId: string, date: string) => ({ id, accountId, date });
    writeMailboxCache('u1', ['a1', 'a2'], 'inbox', {
      messages: [
        mail('m1', 'a1', '2026-10-20T08:00:00Z'),
        mail('m2', 'a2', '2026-10-20T09:00:00Z'),
      ],
      next: { a1: 'tok1' },
      errors: {},
    });
    const merged = readMailboxCache<{ id: string; accountId: string; date: string }>(
      'u1',
      ['a2', 'a1'],
      'inbox'
    );
    expect(merged?.page.messages.map(m => m.id)).toEqual(['m2', 'm1']);
    expect(merged?.page.next).toEqual({ a1: 'tok1' });
    // Uma caixa só: só os dela
    expect(readMailboxCache('u1', ['a1'], 'inbox')?.page.messages).toHaveLength(1);
    // Caixa nova (sem nada guardado): mostra o que houver das outras
    expect(readMailboxCache('u1', ['a1', 'a3'], 'inbox')?.page.messages).toHaveLength(1);
    expect(readMailboxCache('u1', ['a3'], 'inbox')).toBeNull();
  });

  it('uma caixa que deu erro fica com a lista anterior', () => {
    writeMailboxCache('u1', ['a1'], 'inbox', {
      messages: [{ id: 'm1', accountId: 'a1' }],
      next: {},
      errors: {},
    });
    writeMailboxCache('u1', ['a1'], 'inbox', { messages: [], next: {}, errors: { a1: 'x' } });
    expect(readMailboxCache('u1', ['a1'], 'inbox')?.page.messages).toHaveLength(1);
  });
});
