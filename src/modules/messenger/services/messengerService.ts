// Chamadas do Messenger ao Supabase (tabelas chat_*, funções chat_* e bucket chat-files).
// Tudo passa pelas regras de acesso da BD: só os membros leem e escrevem numa conversa.
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { MemberFlag } from '../types';

type Tables = Database['public']['Tables'];
export type MessageRow = Tables['chat_messages']['Row'];
export type MemberRow = Pick<Tables['chat_members']['Row'], 'user_id' | 'last_read_at' | 'role'>;
export type ReactionRow = Pick<Tables['chat_reactions']['Row'], 'message_id' | 'user_id' | 'emoji'>;
export type ConversationRow =
  Database['public']['Functions']['chat_list_conversations']['Returns'][number];
export type DirectoryRow = Database['public']['Functions']['chat_directory']['Returns'][number];

const BUCKET = 'chat-files';
export const PAGE_SIZE = 60;

/** Coluna de chat_members que guarda cada opção da conversa. */
const flagPatch = (flag: MemberFlag, value: boolean): Tables['chat_members']['Update'] =>
  flag === 'pinned'
    ? { is_pinned: value }
    : flag === 'muted'
      ? { is_muted: value }
      : { is_archived: value };

// URLs assinados guardados até perto de expirarem (1 h).
const signedUrls = new Map<string, { url: string; expires: number }>();

/** Nome seguro para o caminho no storage (sem acentos nem símbolos). */
const safeFileName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80) || 'ficheiro';

export const messengerService = {
  /** Garante o canal "Geral" da empresa e a participação do utilizador. */
  bootstrap: async () => {
    const { error } = await supabase.rpc('chat_bootstrap');
    return { error };
  },

  listConversations: async () => {
    const { data, error } = await supabase.rpc('chat_list_conversations');
    return { data: data ?? [], error };
  },

  /** Colegas ativos da mesma empresa (só dados profissionais). */
  getDirectory: async () => {
    const { data, error } = await supabase.rpc('chat_directory');
    return { data: data ?? [], error };
  },

  /** Mensagens mais recentes primeiro; `before` carrega as anteriores. */
  listMessages: async (conversationId: string, before?: string) => {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    return { data: data ?? [], error };
  },

  listMembers: async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_members')
      .select('user_id, last_read_at, role')
      .eq('conversation_id', conversationId);
    return { data: (data ?? []) as MemberRow[], error };
  },

  listReactions: async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_reactions')
      .select('message_id, user_id, emoji')
      .eq('conversation_id', conversationId);
    return { data: (data ?? []) as ReactionRow[], error };
  },

  /** Envia um ficheiro para o bucket privado; devolve o caminho. */
  uploadFile: async (conversationId: string, file: Blob, name: string, mime: string) => {
    const path = `${conversationId}/${crypto.randomUUID()}-${safeFileName(name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: mime, upsert: false });
    return { data: error ? null : path, error };
  },

  /** Copia um anexo para a pasta de outra conversa (encaminhar sem voltar a enviar). */
  copyFile: async (fromPath: string, toConversationId: string, name: string) => {
    const path = `${toConversationId}/${crypto.randomUUID()}-${safeFileName(name)}`;
    const { error } = await supabase.storage.from(BUCKET).copy(fromPath, path);
    return { data: error ? null : path, error };
  },

  insertMessage: async (message: Tables['chat_messages']['Insert']) => {
    const { data, error } = await supabase.from('chat_messages').insert(message).select().single();
    return { data, error };
  },

  editMessage: async (messageId: string, body: string) => {
    const { error } = await supabase.from('chat_messages').update({ body }).eq('id', messageId);
    return { error };
  },

  /** Eliminar apaga o conteúdo na BD (fica "Mensagem eliminada"). */
  deleteMessage: async (messageId: string) => {
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
    return { error };
  },

  addReaction: async (row: Tables['chat_reactions']['Insert']) => {
    const { error } = await supabase.from('chat_reactions').insert(row);
    return { error };
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    const { error } = await supabase
      .from('chat_reactions')
      .delete()
      .match({ message_id: messageId, user_id: userId, emoji });
    return { error };
  },

  markRead: async (conversationId: string) => {
    const { error } = await supabase.rpc('chat_mark_read', { _conversation_id: conversationId });
    return { error };
  },

  setFlag: async (conversationId: string, userId: string, flag: MemberFlag, value: boolean) => {
    const { error } = await supabase
      .from('chat_members')
      .update(flagPatch(flag, value))
      .match({ conversation_id: conversationId, user_id: userId });
    return { error };
  },

  startDirect: async (otherUserId: string) => {
    const { data, error } = await supabase.rpc('chat_start_direct', {
      _other_user_id: otherUserId,
    });
    return { data: data ?? null, error };
  },

  createGroup: async (title: string, memberIds: string[]) => {
    const { data, error } = await supabase.rpc('chat_create_group', {
      _title: title,
      _member_ids: memberIds,
    });
    return { data: data ?? null, error };
  },

  /** URL temporário (1 h) de um anexo; reaproveitado enquanto for válido. */
  getFileUrl: async (path: string) => {
    const cached = signedUrls.get(path);
    if (cached && cached.expires > Date.now()) return { data: cached.url, error: null };
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      signedUrls.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60_000 });
    }
    return { data: data?.signedUrl ?? null, error };
  },
};
