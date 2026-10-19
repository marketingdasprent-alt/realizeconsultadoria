import { afterEach, describe, expect, it } from 'vitest';
import { patchListCaches, readListCache, writeListCache } from '../mailCache';

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
