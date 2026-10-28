import { supabase } from '@/integrations/supabase/client';
import type { NoticeReactionRow } from '../lib/noticeReactions';

export const noticeReactionService = {
  /** Reações aos comunicados indicados (a RLS só devolve as dos que a pessoa vê). */
  list: async (noticeIds: string[]) => {
    if (!noticeIds.length) return { data: [] as NoticeReactionRow[], error: null };
    const { data, error } = await supabase
      .from('notice_reactions')
      .select('notification_id, user_id, emoji')
      .in('notification_id', noticeIds);
    return { data: (data ?? []) as NoticeReactionRow[], error };
  },

  /** Guarda a minha reação (uma por comunicado) ou, com null, retira-a. */
  set: async (noticeId: string, userId: string, emoji: string | null) => {
    const { error } = emoji
      ? await supabase
          .from('notice_reactions')
          .upsert(
            { notification_id: noticeId, user_id: userId, emoji },
            { onConflict: 'notification_id,user_id' }
          )
      : await supabase
          .from('notice_reactions')
          .delete()
          .match({ notification_id: noticeId, user_id: userId });
    return { error };
  },
};
