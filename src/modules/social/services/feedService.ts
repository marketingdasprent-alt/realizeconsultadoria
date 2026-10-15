// Feed no Supabase: publicações (feed_posts), comentários, reações e ficheiros (feed-files).
// As regras da BD decidem quem vê o quê (empresa / departamento).
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { FeedAttachment } from '../types';

export type FeedPostRow = Database['public']['Functions']['feed_list_posts']['Returns'][number];
export type FeedCommentRow = Database['public']['Tables']['feed_comments']['Row'];

const BUCKET = 'feed-files';
export const FEED_PAGE_SIZE = 20;

const safeFileName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80) || 'ficheiro';

const signedUrls = new Map<string, { url: string; expires: number }>();

export const feedService = {
  /** Publicações visíveis, mais recentes primeiro (`before` carrega as anteriores). */
  listPosts: async (before?: string) => {
    const { data, error } = await supabase.rpc('feed_list_posts', {
      _before: before ?? undefined,
      _limit: FEED_PAGE_SIZE,
    });
    return { data: data ?? [], error };
  },

  /** Cria a publicação; os ficheiros são enviados depois para "<id>/…" e associados. */
  createPost: async (input: {
    companyId: string;
    authorId: string;
    body: string | null;
    audience: 'company' | 'department';
    department: string | null;
  }) => {
    const { data, error } = await supabase
      .from('feed_posts')
      .insert({
        company_id: input.companyId,
        author_id: input.authorId,
        body: input.body,
        audience: input.audience,
        department: input.audience === 'department' ? input.department : null,
      })
      .select('id')
      .single();
    return { data: data?.id ?? null, error };
  },

  uploadAttachment: async (postId: string, file: File) => {
    const path = `${postId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    const attachment: FeedAttachment = { path, name: file.name, size: file.size, mime: file.type };
    return { data: error ? null : attachment, error };
  },

  setAttachments: async (postId: string, attachments: FeedAttachment[]) => {
    const { error } = await supabase
      .from('feed_posts')
      .update({ attachments: attachments as unknown as Json })
      .eq('id', postId);
    return { error };
  },

  deletePost: async (postId: string) => {
    const { error } = await supabase
      .from('feed_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId);
    return { error };
  },

  listComments: async (postId: string) => {
    const { data, error } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at');
    return { data: data ?? [], error };
  },

  addComment: async (postId: string, authorId: string, body: string) => {
    const { error } = await supabase
      .from('feed_comments')
      .insert({ post_id: postId, author_id: authorId, body });
    return { error };
  },

  deleteComment: async (commentId: string) => {
    const { error } = await supabase
      .from('feed_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    return { error };
  },

  addReaction: async (postId: string, userId: string, emoji: string) => {
    const { error } = await supabase
      .from('feed_reactions')
      .insert({ post_id: postId, user_id: userId, emoji });
    return { error };
  },

  removeReaction: async (postId: string, userId: string, emoji: string) => {
    const { error } = await supabase
      .from('feed_reactions')
      .delete()
      .match({ post_id: postId, user_id: userId, emoji });
    return { error };
  },

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
