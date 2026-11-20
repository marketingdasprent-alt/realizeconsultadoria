// Chaves do React Query do Messenger e atualização da cache de mensagens.
import type { InfiniteData } from '@tanstack/react-query';
import type { MessageRow } from '../services/messengerService';

export const CHAT_KEYS = {
  boot: ['chat', 'boot'] as const,
  conversations: ['chat', 'conversations'] as const,
  /** Prefixo do diretório (para invalidar o de todas as empresas). */
  directory: ['chat', 'directory'] as const,
  /** O diretório é da empresa da pessoa: mudar de empresa não reaproveita a lista da anterior. */
  directoryFor: (companyId: string | null | undefined) =>
    ['chat', 'directory', companyId ?? 'sem-empresa'] as const,
  thread: (id: string | null) => ['chat', 'thread', id] as const,
  members: (id: string | null) => ['chat', 'members', id] as const,
  reactions: (id: string | null) => ['chat', 'reactions', id] as const,
};

export const DIRECTORY_STALE_MS = 5 * 60_000;
/** Lista vazia: volta a pedir passado pouco tempo, mas não a cada montagem de um avatar. */
export const DIRECTORY_EMPTY_STALE_MS = 15_000;

/**
 * Genérica de propósito: com um tipo fixo (`Query<unknown[], …>` ou `{ data: unknown }`) o React
 * Query passava a inferir as linhas do diretório como `unknown`. Sem dados pede logo; lista
 * vazia nunca fica como definitiva.
 */
export const directoryStaleTime = <T>(query: { state: { data: T | undefined } }): number => {
  const { data } = query.state;
  if (!Array.isArray(data)) return 0;
  return data.length > 0 ? DIRECTORY_STALE_MS : DIRECTORY_EMPTY_STALE_MS;
};

/** Junta (ou substitui) uma mensagem nas páginas em cache da conversa (mais recente primeiro). */
export const upsertThreadRow = (
  data: InfiniteData<MessageRow[]> | undefined,
  row: MessageRow
): InfiniteData<MessageRow[]> | undefined => {
  if (!data) return data;
  const exists = data.pages.some(page => page.some(m => m.id === row.id));
  if (exists) {
    return { ...data, pages: data.pages.map(page => page.map(m => (m.id === row.id ? row : m))) };
  }
  const [first = [], ...rest] = data.pages;
  return { ...data, pages: [[row, ...first], ...rest] };
};
