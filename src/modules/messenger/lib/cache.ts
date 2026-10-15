// Chaves do React Query do Messenger e atualização da cache de mensagens.
import type { InfiniteData } from '@tanstack/react-query';
import type { MessageRow } from '../services/messengerService';

export const CHAT_KEYS = {
  boot: ['chat', 'boot'] as const,
  conversations: ['chat', 'conversations'] as const,
  directory: ['chat', 'directory'] as const,
  thread: (id: string | null) => ['chat', 'thread', id] as const,
  members: (id: string | null) => ['chat', 'members', id] as const,
  reactions: (id: string | null) => ['chat', 'reactions', id] as const,
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
