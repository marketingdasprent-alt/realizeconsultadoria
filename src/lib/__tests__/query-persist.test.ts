import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (event: string, session: { user?: { id: string } } | null) => void;
const auth = vi.hoisted(() => ({ listener: null as AuthListener | null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

import {
  clearDeviceCache,
  readDeviceCache,
  sessionUserId,
  writeDeviceCache,
} from '../device-cache';
import {
  isPersisted,
  persistQueries,
  resetCompanyScopedQueries,
  restoreQueries,
  shouldResetCompanyQueries,
  snapshot,
} from '../query-persist';

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
    expect(isPersisted(['company-files', 'DASPRENT/MARKETING'])).toBe(true);
    expect(isPersisted(['company-files', 'url', 'DASPRENT/x.png'])).toBe(false);
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
    client.setQueryData(['documents', 'x'], { secret: true });
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
    expect(fresh.getQueryData(['documents', 'x'])).toBeUndefined();
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

describe('mudança de empresa', () => {
  it('limpa o que é da empresa e mantém o que é pessoal', async () => {
    const client = new QueryClient();
    client.setQueryData(['chat', 'conversations'], [{ id: 'c1' }]);
    client.setQueryData(['chat', 'directory', 'antiga'], []);
    client.setQueryData(['feed', 'posts'], [{ id: 'p1' }]);
    client.setQueryData(['company-files', 'X'], [1]);
    client.setQueryData(['calendar', 'team', 'a'], [1]);
    client.setQueryData(['tasks', 'mine'], [{ id: 't1' }]);
    client.setQueryData(['notifications'], [{ id: 'n1' }]);
    client.setQueryData(['calendar', 'events', 'a'], [1]);

    await resetCompanyScopedQueries(client);

    expect(client.getQueryData(['chat', 'conversations'])).toBeUndefined();
    expect(client.getQueryData(['chat', 'directory', 'antiga'])).toBeUndefined();
    expect(client.getQueryData(['feed', 'posts'])).toBeUndefined();
    expect(client.getQueryData(['company-files', 'X'])).toBeUndefined();
    expect(client.getQueryData(['calendar', 'team', 'a'])).toBeUndefined();
    expect(client.getQueryData(['tasks', 'mine'])).toEqual([{ id: 't1' }]);
    expect(client.getQueryData(['notifications'])).toEqual([{ id: 'n1' }]);
    expect(client.getQueryData(['calendar', 'events', 'a'])).toEqual([1]);
  });
});

describe('sessão: nada de uma conta passa para a outra', () => {
  let stop: (() => void) | null = null;

  const hideTab = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  afterEach(() => {
    stop?.();
    stop = null;
    auth.listener = null;
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('terminar a sessão limpa a cache guardada e a cache em memória', () => {
    session('u1');
    const client = new QueryClient();
    client.setQueryData(['chat', 'directory', 'empresa-a'], [{ user_id: 'x' }]);
    client.setQueryData(['tasks', 'mine'], [{ id: 't1' }]);
    stop = persistQueries(client);
    hideTab();
    expect(readDeviceCache('queries', 'u1')).not.toBeNull();

    auth.listener?.('SIGNED_OUT', null);

    expect(readDeviceCache('queries', 'u1')).toBeNull();
    expect(client.getQueryData(['chat', 'directory', 'empresa-a'])).toBeUndefined();
    expect(client.getQueryData(['tasks', 'mine'])).toBeUndefined();
  });

  it('outra conta a entrar no mesmo separador não vê dados da anterior', () => {
    session('u1');
    const client = new QueryClient();
    client.setQueryData(['feed', 'posts'], [{ id: 'p1' }]);
    stop = persistQueries(client);

    session('u2');
    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });

    expect(client.getQueryData(['feed', 'posts'])).toBeUndefined();
  });

  it('a mesma conta a renovar o token mantém a cache', () => {
    session('u1');
    const client = new QueryClient();
    client.setQueryData(['feed', 'posts'], [{ id: 'p1' }]);
    stop = persistQueries(client);

    auth.listener?.('TOKEN_REFRESHED', { user: { id: 'u1' } });
    auth.listener?.('SIGNED_IN', { user: { id: 'u1' } });

    expect(client.getQueryData(['feed', 'posts'])).toEqual([{ id: 'p1' }]);
  });

  it('depois de terminar a sessão não volta a gravar nada', () => {
    session('u1');
    const client = new QueryClient();
    client.setQueryData(['chat', 'conversations'], [{ id: 'c1' }]);
    stop = persistQueries(client);

    auth.listener?.('SIGNED_OUT', null);
    client.setQueryData(['chat', 'conversations'], [{ id: 'c-novo' }]);
    hideTab();

    expect(readDeviceCache('queries', 'u1')).toBeNull();
  });

  it('nunca grava dados em memória de uma conta na chave de outra', () => {
    session('u1');
    const client = new QueryClient();
    client.setQueryData(['chat', 'conversations'], [{ id: 'c-da-conta-1' }]);
    stop = persistQueries(client);

    // A sessão do aparelho passou para u2 sem o evento ter chegado ainda.
    session('u2');
    hideTab();

    expect(readDeviceCache('queries', 'u2')).toBeNull();
  });
});

describe('empresa ativa', () => {
  afterEach(() => localStorage.clear());

  it('na mesma conta, ao mudar de empresa a lista guardada da anterior desaparece', async () => {
    session('u1');
    const before = new QueryClient();
    before.setQueryData(['chat', 'directory', 'empresa-a'], [{ user_id: 'colega-a' }]);
    before.setQueryData(['feed', 'posts'], [{ id: 'post-a' }]);
    before.setQueryData(['tasks', 'mine'], [{ id: 't1' }]);
    writeDeviceCache('queries', 'u1', { version: 1, savedAt: Date.now(), state: snapshot(before) });

    const after = new QueryClient();
    restoreQueries(after, 'u1');
    expect(after.getQueryData(['chat', 'directory', 'empresa-a'])).toEqual([
      { user_id: 'colega-a' },
    ]);

    await resetCompanyScopedQueries(after);

    expect(after.getQueryData(['chat', 'directory', 'empresa-a'])).toBeUndefined();
    expect(after.getQueryData(['chat', 'directory', 'empresa-b'])).toBeUndefined();
    expect(after.getQueryData(['feed', 'posts'])).toBeUndefined();
    expect(after.getQueryData(['tasks', 'mine'])).toEqual([{ id: 't1' }]);
  });
});

describe('shouldResetCompanyQueries', () => {
  it('muda de empresa: limpa', () => {
    expect(shouldResetCompanyQueries('a', 'b')).toBe(true);
  });

  it('mesma empresa: mantém', () => {
    expect(shouldResetCompanyQueries('a', 'a')).toBe(false);
  });

  it('empresa anterior desconhecida: limpa, porque a cache guardada pode ser de outra', () => {
    expect(shouldResetCompanyQueries(null, 'a')).toBe(true);
  });

  it('ficha sem empresa: não faz nada', () => {
    expect(shouldResetCompanyQueries('a', null)).toBe(false);
    expect(shouldResetCompanyQueries(null, null)).toBe(false);
  });
});
