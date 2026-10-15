// Comentários de uma publicação (carregados só quando se abrem).
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_COMMENTS } from '../lib/demoData';
import { FEED_KEYS } from '../lib/feed';
import { feedService } from '../services/feedService';
import type { FeedComment } from '../types';
import { useDirectory } from './useDirectory';

export const useFeedComments = (postId: string, enabled: boolean) => {
  const { isPreview, user } = useWorkspace();
  const { nameOf } = useDirectory();
  const qc = useQueryClient();
  const [demo, setDemo] = useState<FeedComment[]>(DEMO_COMMENTS[postId] ?? []);

  const live = useQuery({
    queryKey: FEED_KEYS.comments(postId),
    queryFn: async () => {
      const { data, error } = await feedService.listComments(postId);
      if (error) throw error;
      return data;
    },
    enabled: enabled && !isPreview,
  });

  const comments: FeedComment[] = useMemo(
    () =>
      isPreview
        ? demo
        : (live.data ?? []).map(row => ({
            id: row.id,
            postId: row.post_id,
            authorId: row.author_id,
            authorName: nameOf(row.author_id),
            isMine: row.author_id === user.userId,
            body: row.body,
            createdAt: row.created_at,
          })),
    [isPreview, demo, live.data, nameOf, user.userId]
  );

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: FEED_KEYS.comments(postId) }),
      qc.invalidateQueries({ queryKey: FEED_KEYS.posts }),
    ]);

  const add = async (body: string): Promise<boolean> => {
    const text = body.trim();
    if (!text) return false;
    if (isPreview) {
      setDemo(list => [
        ...list,
        {
          id: `demo-${Date.now()}`,
          postId,
          authorId: user.userId,
          authorName: user.name,
          isMine: true,
          body: text,
          createdAt: new Date().toISOString(),
        },
      ]);
      return true;
    }
    const { error } = await feedService.addComment(postId, user.userId, text);
    if (error) {
      toast({ title: 'O comentário não foi publicado', variant: 'destructive' });
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (commentId: string) => {
    if (isPreview) return setDemo(list => list.filter(c => c.id !== commentId));
    const { error } = await feedService.deleteComment(commentId);
    if (!error) await refresh();
  };

  return { comments, isLoading: !isPreview && live.isLoading, add, remove };
};
