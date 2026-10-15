import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { FEED_KEYS } from '../lib/feed';

/**
 * Feed em tempo real: publicações novas de colegas acendem o aviso "Novas publicações"
 * (sem saltar a página); comentários novos atualizam a publicação.
 */
export const useFeedRealtime = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const userRef = useRef(user.userId);
  userRef.current = user.userId;

  useEffect(() => {
    if (isPreview) return;
    const channel = supabase
      .channel(`feed-${user.companyId}-${user.userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_posts' }, p => {
        if ((p.new as { author_id?: string }).author_id !== userRef.current) setHasNewPosts(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_comments' }, p => {
        const postId = (p.new as { post_id?: string }).post_id;
        if (postId) qc.invalidateQueries({ queryKey: FEED_KEYS.comments(postId) });
        qc.invalidateQueries({ queryKey: FEED_KEYS.posts });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, user.companyId, user.userId, qc]);

  return {
    hasNewPosts,
    showNewPosts: async () => {
      setHasNewPosts(false);
      await qc.invalidateQueries({ queryKey: FEED_KEYS.posts });
    },
  };
};
