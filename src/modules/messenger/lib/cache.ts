// Chaves do React Query do Messenger e atualização da cache de mensagens.
import type { InfiniteData, Query } from '@tanstack/react-query';
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

/** Lista vazia (ou ainda sem dados) conta como antiga: nunca fica como definitiva. */
export const directoryStaleTime = (query: Query<unknown[], unknown, unknown[]>): number =>
  Array.isArray(query.state.data) && query.state.data.length > 0 ? DIRECTORY_STALE_MS : 0;

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
