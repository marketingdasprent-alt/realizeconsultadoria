// Reações aos comunicados no Feed: uma por pessoa, para dar para votações.
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { applyReaction, reactionsOf, type NoticeReactionRow } from '../lib/noticeReactions';
import { noticeReactionService } from '../services/noticeReactionService';
import type { Notice } from '../types';

export const useNoticeReactions = (notices: Notice[]) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [demo, setDemo] = useState<NoticeReactionRow[]>([]);
  const ids = notices.map(n => n.id);
  const key = ['feed', 'notice-reactions', ids.join(',')];

  const live = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await noticeReactionService.list(ids);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview && ids.length > 0,
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => (isPreview ? demo : (live.data ?? [])), [isPreview, demo, live.data]);

  const react = async (noticeId: string, emoji: string) => {
    const next = applyReaction(rows, noticeId, user.userId, emoji);
    if (isPreview) return setDemo(next.rows);
    // Mostra já; se o servidor recusar, volta atrás.
    const before = rows;
    qc.setQueryData(key, next.rows);
    const { error } = await noticeReactionService.set(noticeId, user.userId, next.emoji);
    if (error) {
      qc.setQueryData(key, before);
      toast({ title: 'A reação não ficou guardada', variant: 'destructive' });
    }
    void qc.invalidateQueries({ queryKey: key });
  };

  const reactionsFor = useCallback(
    (noticeId: string) => reactionsOf(rows, noticeId, user.userId),
    [rows, user.userId]
  );

  return { reactionsFor, react };
};
