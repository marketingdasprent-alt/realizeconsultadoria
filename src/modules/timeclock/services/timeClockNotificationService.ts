import { supabase } from '@/integrations/supabase/client';
import type { NotificationEmail } from '@/lib/timeclock';

/** Emails que recebem os pedidos de aprovação de ponto (remoto / com alertas). */
export const timeClockNotificationService = {
  list: async () => {
    const { data, error } = await supabase
      .from('notification_emails_timeclock')
      .select('*')
      .order('created_at');
    return { data: (data ?? []) as NotificationEmail[], error };
  },

  add: async (email: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('notification_emails_timeclock')
      .insert({ email: email.trim().toLowerCase(), created_by: auth.user?.id ?? null })
      .select()
      .single();
    return { data: data as NotificationEmail | null, error };
  },

  setActive: async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('notification_emails_timeclock')
      .update({ is_active: isActive })
      .eq('id', id);
    return { success: !error, error };
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('notification_emails_timeclock').delete().eq('id', id);
    return { success: !error, error };
  },
};
