// Notificações do utilizador (user_notifications): criadas pela BD, lidas aqui.
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type NotificationRow = Database['public']['Tables']['user_notifications']['Row'];

export const notificationService = {
  /** As mais recentes (as regras da BD só devolvem as do próprio). */
  list: async (limit = 50) => {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: data ?? [], error };
  },

  markRead: async (ids: string[]) => {
    if (ids.length === 0) return { error: null };
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
      .is('read_at', null);
    return { error };
  },
};
