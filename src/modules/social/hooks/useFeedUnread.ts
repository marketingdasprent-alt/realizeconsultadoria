// Novidades do Feed desde a última visita (bolinha no menu). Vê-se o Feed => conta como visto.
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { FEED_KEYS } from '../lib/feed';
import { feedService } from '../services/feedService';

const REFRESH_MS = 2 * 60_000;

export const useFeedUnread = () => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: FEED_KEYS.unread,
    queryFn: async () => {
      const { data, error } = await feedService.unreadCount();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
    staleTime: 30_000,
    refetchInterval: () => (document.hidden ? false : REFRESH_MS),
    refetchOnWindowFocus: true,
  });

  const markSeen = useCallback(() => {
    if (isPreview) return;
    qc.setQueryData(FEED_KEYS.unread, 0);
    void feedService.markSeen();
  }, [isPreview, qc]);

  return { count: isPreview ? 0 : (query.data ?? 0), markSeen };
};
