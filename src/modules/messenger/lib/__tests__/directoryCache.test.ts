import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import { isPersisted, restoreQueries, snapshot } from '@/lib/query-persist';
import { writeDeviceCache } from '@/lib/device-cache';
import {
  CHAT_KEYS,
  DIRECTORY_EMPTY_STALE_MS,
  DIRECTORY_STALE_MS,
  directoryStaleTime,
} from '../cache';

describe('chave do diretório por empresa', () => {
  afterEach(() => localStorage.clear());

  it('sem empresa usa uma chave própria', () => {
    expect(CHAT_KEYS.directoryFor(null)).toEqual(['chat', 'directory', 'sem-empresa']);
    expect(CHAT_KEYS.directoryFor(undefined)).toEqual(['chat', 'directory', 'sem-empresa']);
  });

  it('inclui a empresa e difere entre empresas', () => {
    expect(CHAT_KEYS.directoryFor('empresa-a')).toEqual(['chat', 'directory', 'empresa-a']);
    expect(CHAT_KEYS.directoryFor('empresa-a')).not.toEqual(CHAT_KEYS.directoryFor('empresa-b'));
  });

  it('continua guardada no aparelho', () => {
    expect(isPersisted(CHAT_KEYS.directoryFor('empresa-a'))).toBe(true);
  });

  it('a invalidação pelo prefixo antigo apanha todas as empresas', async () => {
    const client = new QueryClient();
    client.setQueryData(CHAT_KEYS.directoryFor('a'), [{ user_id: 'u1' }]);
    client.setQueryData(CHAT_KEYS.directoryFor('b'), [{ user_id: 'u2' }]);
    await client.invalidateQueries({ queryKey: CHAT_KEYS.directory });
    expect(client.getQueryState(CHAT_KEYS.directoryFor('a'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(CHAT_KEYS.directoryFor('b'))?.isInvalidated).toBe(true);
  });

  it('a lista guardada de uma empresa só aparece na chave dessa empresa', () => {
    localStorage.setItem('sb-proj-auth-token', JSON.stringify({ user: { id: 'u1' } }));
    const before = new QueryClient();
    before.setQueryData(CHAT_KEYS.directoryFor('antiga'), []);
    writeDeviceCache('queries', 'u1', { version: 1, savedAt: Date.now(), state: snapshot(before) });

    const after = new QueryClient();
    restoreQueries(after, 'u1');
    expect(after.getQueryData(CHAT_KEYS.directoryFor('antiga'))).toEqual([]);
    expect(after.getQueryData(CHAT_KEYS.directoryFor('nova'))).toBeUndefined();
  });
});

describe('directoryStaleTime', () => {
  const query = (data: unknown) => ({ state: { data } });

  it('sem dados vai sempre buscar', () => {
    expect(directoryStaleTime(query(undefined))).toBe(0);
  });

  it('lista vazia conta como antiga muito depressa, sem pedir a cada montagem', () => {
    expect(directoryStaleTime(query([]))).toBe(DIRECTORY_EMPTY_STALE_MS);
    expect(DIRECTORY_EMPTY_STALE_MS).toBeGreaterThan(0);
    expect(DIRECTORY_EMPTY_STALE_MS).toBeLessThan(DIRECTORY_STALE_MS);
  });

  it('lista com pessoas fica fresca 5 minutos', () => {
    expect(directoryStaleTime(query([{ user_id: 'u1' }]))).toBe(DIRECTORY_STALE_MS);
  });
});
