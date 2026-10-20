import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import {
  clearDeviceCache,
  readDeviceCache,
  sessionUserId,
  writeDeviceCache,
} from '../device-cache';
import { isPersisted, restoreQueries, snapshot } from '../query-persist';

const session = (userId: string) =>
  localStorage.setItem('sb-proj-auth-token', JSON.stringify({ user: { id: userId } }));

describe('cache no aparelho', () => {
  afterEach(() => localStorage.clear());

  it('lê o utilizador da sessão guardada e separa a cache por utilizador', () => {
    session('u1');
    expect(sessionUserId()).toBe('u1');
    writeDeviceCache('x', 'u1', { a: 1 });
    expect(readDeviceCache('x', 'u1')).toEqual({ a: 1 });
    expect(readDeviceCache('x', 'u2')).toBeNull();
    clearDeviceCache();
    expect(readDeviceCache('x', 'u1')).toBeNull();
  });

  it('guarda só as áreas do dia a dia (nada de documentos, recibos ou finanças)', () => {
    expect(isPersisted(['chat', 'conversations'])).toBe(true);
    expect(isPersisted(['chat', 'thread', 'c1'])).toBe(true);
    expect(isPersisted(['calendar', 'events', 'a', 'b'])).toBe(true);
    expect(isPersisted(['chat', 'boot'])).toBe(false);
    expect(isPersisted(['company-files', ''])).toBe(false);
    expect(isPersisted(['documents'])).toBe(false);
    expect(isPersisted(['mail', 'list', 'all'])).toBe(false);
  });

  it('das conversas guarda só a 1.ª página e devolve tudo ao abrir', () => {
    const client = new QueryClient();
    client.setQueryData(['chat', 'conversations'], [{ id: 'c1' }]);
    client.setQueryData(['chat', 'thread', 'c1'], {
      pages: [['m3'], ['m2'], ['m1']],
      pageParams: [null, 'a', 'b'],
    });
    client.setQueryData(['company-files', 'x'], { secret: true });
    const state = snapshot(client);
    expect(state.queries.map(q => q.queryKey)).toEqual([
      ['chat', 'conversations'],
      ['chat', 'thread', 'c1'],
    ]);

    session('u1');
    writeDeviceCache('queries', 'u1', { version: 1, savedAt: Date.now(), state });
    const fresh = new QueryClient();
    restoreQueries(fresh);
    expect(fresh.getQueryData(['chat', 'conversations'])).toEqual([{ id: 'c1' }]);
    expect(fresh.getQueryData(['chat', 'thread', 'c1'])).toEqual({
      pages: [['m3']],
      pageParams: [null],
    });
    expect(fresh.getQueryData(['company-files', 'x'])).toBeUndefined();
  });

  it('não mostra a cache de outro utilizador nem cache com mais de uma semana', () => {
    const client = new QueryClient();
    client.setQueryData(['tasks'], [{ id: 't1' }]);
    writeDeviceCache('queries', 'u1', { version: 1, savedAt: Date.now(), state: snapshot(client) });
    session('u2');
    const other = new QueryClient();
    restoreQueries(other);
    expect(other.getQueryData(['tasks'])).toBeUndefined();

    session('u1');
    writeDeviceCache('queries', 'u1', {
      version: 1,
      savedAt: Date.now() - 8 * 24 * 3600 * 1000,
      state: snapshot(client),
    });
    const old = new QueryClient();
    restoreQueries(old);
    expect(old.getQueryData(['tasks'])).toBeUndefined();
  });
});
