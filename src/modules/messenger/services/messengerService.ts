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
  Database['public']['Functions']['chat_list_conversations']['Returns'][number] & {
    /** Foto do grupo (bucket público avatars). */
    avatar_path?: string | null;
  };
export type DirectoryRow = Database['public']['Functions']['chat_directory']['Returns'][number];

const BUCKET = 'chat-files';
export const PAGE_SIZE = 60;

/** Coluna das preferências (só do próprio) que guarda cada opção da conversa. */
const flagColumn = (flag: MemberFlag) =>
  flag === 'pinned' ? 'is_pinned' : flag === 'muted' ? 'is_muted' : 'is_archived';

// URLs assinados guardados até perto de expirarem (1 h).
const signedUrls = new Map<string, { url: string; expires: number }>();

/** Nome seguro para o caminho no storage (sem acentos nem símbolos). */
const safeFileName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80) || 'ficheiro';

/** Recorta ao centro e reduz a imagem a um quadrado JPEG (fotos de grupo leves). */
const squareJpeg = async (file: File, size: number): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    ?.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('imagem'))), 'image/jpeg', 0.86)
  );
};

export const messengerService = {
  /** Garante o canal "Geral" da empresa e a participação do utilizador. */
  bootstrap: async () => {
    const { error } = await supabase.rpc('chat_bootstrap');
    return { error };
  },

  /** As conversas, com a foto dos grupos (a lista vem de uma função; a foto, da tabela). */
  listConversations: async () => {
    const { data, error } = await supabase.rpc('chat_list_conversations');
    const rows: ConversationRow[] = data ?? [];
    const groupIds = rows.filter(row => row.kind === 'group').map(row => row.id);
    if (!error && groupIds.length) {
      const { data: photos } = await supabase
        .from('chat_conversations')
        .select('id, avatar_path')
        .in('id', groupIds)
        .not('avatar_path', 'is', null);
      const byId = new Map((photos ?? []).map(photo => [photo.id, photo.avatar_path]));
      for (const row of rows) row.avatar_path = byId.get(row.id) ?? null;
    }
    return { data: rows, error };
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

  /** Apaga o ficheiro de uma mensagem eliminada (só quem o enviou pode). */
  deleteFile: async (path: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
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

  /**
   * Fixar, silenciar ou arquivar: preferências só do próprio (os outros membros não as veem).
   * O upsert cria a linha na primeira vez e depois só muda a coluna enviada.
   */
  setFlag: async (conversationId: string, userId: string, flag: MemberFlag, value: boolean) => {
    const row: Database['public']['Tables']['chat_member_settings']['Insert'] = {
      conversation_id: conversationId,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    row[flagColumn(flag)] = value;
    const { error } = await supabase
      .from('chat_member_settings')
      .upsert(row, { onConflict: 'conversation_id,user_id' });
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

  /** Pôr colegas num grupo (qualquer membro); devolve quantos entraram. */
  addMembers: async (conversationId: string, userIds: string[]) => {
    const { data, error } = await supabase.rpc('chat_add_members', {
      _conversation_id: conversationId,
      _user_ids: userIds,
    });
    return { data: data ?? 0, error };
  },

  /** Tirar alguém do grupo (só o dono) ou sair (o próprio). */
  removeMember: async (conversationId: string, userId: string) => {
    const { error } = await supabase.rpc('chat_remove_member', {
      _conversation_id: conversationId,
      _user_id: userId,
    });
    return { error };
  },

  renameGroup: async (conversationId: string, title: string) => {
    const { error } = await supabase.rpc('chat_rename_group', {
      _conversation_id: conversationId,
      _title: title,
    });
    return { error };
  },

  /** Foto do grupo: reduzida a 256 px, enviada para avatars/groups/<grupo>/ (null tira). */
  setGroupAvatar: async (conversationId: string, file: File | null) => {
    let path: string | null = null;
    if (file) {
      const blob = await squareJpeg(file, 256);
      path = `groups/${conversationId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadError) return { error: uploadError };
    }
    const { error } = await supabase.rpc('chat_set_group_avatar', {
      _conversation_id: conversationId,
      _path: path,
    });
    return { error };
  },

  groupAvatarUrl: (path: string) =>
    supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl,

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
