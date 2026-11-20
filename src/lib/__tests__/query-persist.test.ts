import { QueryClient, QueryObserver } from '@tanstack/react-query';
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
  clearAllDeviceData,
  clearDeviceCache,
  readDeviceCache,
  sessionChangedSince,
  sessionUserId,
  writeDeviceCache,
  writeDeviceCacheIfSession,
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
    expect(client.getQueryData(['calendar', 'events', 'a'])).toBeUndefined();
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
    // O diretório da empresa anterior sai da cache (não fica só reposto) para não ser pedido na chave velha.
    expect(
      after.getQueryCache().find({ queryKey: ['chat', 'directory', 'empresa-a'] })
    ).toBeUndefined();
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

describe('limpar tudo o que é do utilizador no aparelho', () => {
  afterEach(() => localStorage.clear());

  const fill = (id: string) => {
    localStorage.setItem(`rz-cache:${id}:queries`, '{}');
    localStorage.setItem(`rz-mail-cache:${id}:inbox`, '{}');
    localStorage.setItem(`rz-ai-chat:${id}`, '[]');
    localStorage.setItem(`rz.role.${id}`, 'admin');
  };
  const keysOf = (id: string) => Object.keys(localStorage).filter(k => k.includes(id));

  it('apaga cache, emails, chat IA e papel, e deixa o resto (sessão, tema)', () => {
    fill('u1');
    localStorage.setItem('sb-proj-auth-token', '{}');
    localStorage.setItem('theme', 'dark');

    clearAllDeviceData();

    expect(keysOf('u1')).toEqual([]);
    expect(localStorage.getItem('sb-proj-auth-token')).toBe('{}');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('pode poupar o utilizador que acabou de entrar', () => {
    fill('u1');
    fill('u2');

    clearAllDeviceData('u2');

    expect(keysOf('u1')).toEqual([]);
    expect(keysOf('u2')).toHaveLength(4);
  });

  it('apaga também separadores, rascunhos e recentes que ficavam para a conta seguinte', () => {
    localStorage.setItem('rz-tabs:u1', '[]');
    localStorage.setItem('rz.admin.broadcast.draft', '{"texto":"rascunho"}');
    localStorage.setItem('rz.people.recent', '["x"]');
    localStorage.setItem('rz.mail.supportCompany', 'empresa');
    localStorage.setItem('rz-last-punch-at', '1');

    clearAllDeviceData('u2');

    expect(localStorage.length).toBe(0);
  });

  it('as chaves globais saem sempre, mesmo a poupar a conta nova; as da conta nova ficam', () => {
    localStorage.setItem('rz.people.recent', '["x"]');
    localStorage.setItem('rz-tabs:u2', '[]');

    clearAllDeviceData('u2');

    expect(localStorage.getItem('rz.people.recent')).toBeNull();
    expect(localStorage.getItem('rz-tabs:u2')).toBe('[]');
  });

  it('poupa só as chaves exatas da conta nova (um id parecido não a protege)', () => {
    localStorage.setItem('rz.role.u2', 'admin');
    localStorage.setItem('rz-ai-chat:xu2', '[]');
    localStorage.setItem('rz-mail-cache:u22:inbox', '{}');

    clearAllDeviceData('u2');

    expect(localStorage.getItem('rz.role.u2')).toBe('admin');
    expect(localStorage.getItem('rz-ai-chat:xu2')).toBeNull();
    expect(localStorage.getItem('rz-mail-cache:u22:inbox')).toBeNull();
  });

  it('sessionChangedSince: só diz que mudou se havia dono e a sessão já é outra', () => {
    session('u1');
    expect(sessionChangedSince('u1')).toBe(false);
    expect(sessionChangedSince(null)).toBe(false);
    session('u2');
    expect(sessionChangedSince('u1')).toBe(true);
  });

  it('só grava se a sessão ainda for a de quem pediu', () => {
    session('u1');
    writeDeviceCacheIfSession('x', 'u1', { a: 1 });
    expect(readDeviceCache('x', 'u1')).toEqual({ a: 1 });

    session('u2');
    writeDeviceCacheIfSession('x', 'u1', { a: 2 });
    expect(readDeviceCache('x', 'u1')).toEqual({ a: 1 });
    expect(readDeviceCache('x', 'u2')).toBeNull();
  });
});

describe('sessão: limpeza completa e observadores montados', () => {
  let stop: (() => void) | null = null;
  afterEach(() => {
    stop?.();
    stop = null;
    auth.listener = null;
    localStorage.clear();
  });

  it('terminar a sessão limpa também emails, chat IA e papel (sessão expirada, outro separador)', () => {
    session('u1');
    localStorage.setItem('rz-mail-cache:u1:inbox', '{}');
    localStorage.setItem('rz-ai-chat:u1', '[]');
    localStorage.setItem('rz.role.u1', 'admin');
    stop = persistQueries(new QueryClient());

    auth.listener?.('SIGNED_OUT', null);

    expect(localStorage.getItem('rz-mail-cache:u1:inbox')).toBeNull();
    expect(localStorage.getItem('rz-ai-chat:u1')).toBeNull();
    expect(localStorage.getItem('rz.role.u1')).toBeNull();
  });

  it('conta nova sem dono anterior (sessão que desapareceu sem SIGNED_OUT) apaga o que ficou no aparelho', () => {
    localStorage.setItem('rz-mail-cache:u1:inbox', '{}');
    localStorage.setItem('rz.role.u2', 'colaborador');
    stop = persistQueries(new QueryClient());

    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });

    expect(localStorage.getItem('rz-mail-cache:u1:inbox')).toBeNull();
    expect(localStorage.getItem('rz.role.u2')).toBe('colaborador');
  });

  it('outra conta a entrar também limpa as mutações em memória', () => {
    session('u1');
    const client = new QueryClient();
    stop = persistQueries(client);
    const clearMutations = vi.spyOn(client.getMutationCache(), 'clear');

    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });

    expect(clearMutations).toHaveBeenCalled();
  });

  it('terminar a sessão cancela os pedidos em curso: a resposta tardia não volta à cache', async () => {
    session('u1');
    const client = new QueryClient();
    let answer: (value: unknown) => void = () => undefined;
    const observer = new QueryObserver(client, {
      queryKey: ['feed', 'posts'],
      queryFn: () => new Promise(resolve => (answer = resolve)),
    });
    const unsubscribe = observer.subscribe(() => undefined);
    stop = persistQueries(client);

    auth.listener?.('SIGNED_OUT', null);
    answer(['da-conta-1']);
    await Promise.resolve();

    expect(client.getQueryData(['feed', 'posts'])).toBeUndefined();
    unsubscribe();
  });

  it('outra conta a entrar apaga o que ficou no aparelho da anterior e mantém o da nova', () => {
    session('u1');
    localStorage.setItem('rz-mail-cache:u1:inbox', '{}');
    localStorage.setItem('rz.role.u2', 'colaborador');
    stop = persistQueries(new QueryClient());

    session('u2');
    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });

    expect(localStorage.getItem('rz-mail-cache:u1:inbox')).toBeNull();
    expect(localStorage.getItem('rz.role.u2')).toBe('colaborador');
  });

  it('outra conta a entrar com uma lista montada: a lista é pedida de novo, sem dados da anterior', async () => {
    session('u1');
    const client = new QueryClient();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(['da-conta-1'])
      .mockResolvedValueOnce(['da-conta-2']);
    const observer = new QueryObserver(client, { queryKey: ['feed', 'posts'], queryFn });
    const seen: unknown[] = [];
    const unsubscribe = observer.subscribe(result => seen.push(result.data));
    await vi.waitFor(() => expect(client.getQueryData(['feed', 'posts'])).toEqual(['da-conta-1']));
    stop = persistQueries(client);

    session('u2');
    auth.listener?.('SIGNED_IN', { user: { id: 'u2' } });
    await vi.waitFor(() => expect(client.getQueryData(['feed', 'posts'])).toEqual(['da-conta-2']));

    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
