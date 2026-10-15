// Publicações do Feed: listar (com paginação), publicar, eliminar e reagir.
import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_POSTS } from '../lib/demoData';
import { FEED_KEYS, toPost, toggleReactionIn, validatePostFiles } from '../lib/feed';
import { FEED_PAGE_SIZE, feedService } from '../services/feedService';
import type { FeedAttachment, FeedPost, NewPostInput } from '../types';
import { useDirectory } from './useDirectory';

const fail = (description: string): void => {
  toast({ title: 'Não foi possível', description, variant: 'destructive' });
};

export const useFeedPosts = () => {
  const { isPreview, user } = useWorkspace();
  const { nameOf, byId } = useDirectory();
  const qc = useQueryClient();
  const [demoPosts, setDemoPosts] = useState<FeedPost[]>(DEMO_POSTS);
  const [isPublishing, setIsPublishing] = useState(false);

  const live = useInfiniteQuery({
    queryKey: FEED_KEYS.posts,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await feedService.listPosts(pageParam);
      if (error) throw error;
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last =>
      last.length === FEED_PAGE_SIZE ? last[last.length - 1].created_at : undefined,
    enabled: !isPreview,
  });

  const posts = useMemo(
    () =>
      isPreview
        ? demoPosts
        : (live.data?.pages.flat() ?? []).map(row => toPost(row, user.userId, nameOf, byId)),
    [isPreview, demoPosts, live.data, user.userId, nameOf, byId]
  );
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: FEED_KEYS.posts }), [qc]);

  const publish = async (input: NewPostInput): Promise<boolean> => {
    const problem = validatePostFiles(input.files);
    if (problem) return (fail(problem), false);
    const body = input.body.trim() || null;
    if (!body && input.files.length === 0) return false;
    if (isPreview) {
      const attachments: FeedAttachment[] = input.files.map(file => ({
        path: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        mime: file.type,
      }));
      setDemoPosts(list => [
        {
          id: `demo-${Date.now()}`,
          authorId: user.userId,
          authorName: user.name,
          authorRole: [user.position, user.department].filter(Boolean).join(' · ') || null,
          isMine: true,
          body,
          audience: input.audience,
          department: input.audience === 'department' ? user.department : null,
          attachments,
          createdAt: new Date().toISOString(),
          editedAt: null,
          commentCount: 0,
          reactions: [],
        },
        ...list,
      ]);
      return true;
    }
    setIsPublishing(true);
    try {
      const created = await feedService.createPost({
        companyId: user.companyId,
        authorId: user.userId,
        body,
        audience: input.audience,
        department: user.department,
      });
      if (created.error || !created.data) return (fail('A publicação não foi criada.'), false);
      const uploads = await Promise.all(
        input.files.map(file => feedService.uploadAttachment(created.data as string, file))
      );
      const attachments = uploads.flatMap(upload => (upload.data ? [upload.data] : []));
      if (attachments.length < input.files.length) fail('Alguns ficheiros não foram enviados.');
      if (attachments.length > 0) await feedService.setAttachments(created.data, attachments);
      await refresh();
      return true;
    } finally {
      setIsPublishing(false);
    }
  };

  const remove = async (postId: string) => {
    if (isPreview) return setDemoPosts(list => list.filter(p => p.id !== postId));
    const { error } = await feedService.deletePost(postId);
    if (error) return fail('A publicação não foi eliminada.');
    await refresh();
  };

  const toggleReaction = async (post: FeedPost, emoji: string) => {
    if (isPreview) {
      return setDemoPosts(list =>
        list.map(p =>
          p.id === post.id ? { ...p, reactions: toggleReactionIn(p.reactions, emoji) } : p
        )
      );
    }
    const mine = post.reactions.some(r => r.emoji === emoji && r.mine);
    const { error } = mine
      ? await feedService.removeReaction(post.id, user.userId, emoji)
      : await feedService.addReaction(post.id, user.userId, emoji);
    if (error) return fail('A reação não foi guardada.');
    await refresh();
  };

  return {
    posts,
    isLoading: !isPreview && live.isLoading,
    hasMore: !isPreview && !!live.hasNextPage,
    loadMore: () => live.fetchNextPage(),
    isPublishing,
    publish,
    remove,
    toggleReaction,
    refresh,
  };
};
