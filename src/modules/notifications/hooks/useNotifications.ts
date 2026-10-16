// Centro de notificações (briefing §18): notificações da BD em tempo real, mais os
// contadores de mensagens por ler e de comunicados por confirmar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { useNotices } from '@/modules/social/hooks/useNotices';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_NOTIFICATIONS } from '../lib/demoData';
import { notificationService, type NotificationRow } from '../services/notificationService';

const KEY = ['notifications'] as const;

export const useNotifications = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const messenger = useOptionalMessenger();
  const { unread: noticesUnread } = useNotices();
  const [demo, setDemo] = useState<NotificationRow[]>(DEMO_NOTIFICATIONS);

  const live = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await notificationService.list();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
    // Lidas noutro separador ou no telemóvel: ao voltar a esta janela o contador acerta.
    refetchOnWindowFocus: true,
  });

  // Notificação nova: atualiza a lista e mostra um aviso discreto.
  useEffect(() => {
    if (isPreview || !user.userId) return;
    const channel = supabase
      .channel(`notifications-${user.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.userId}`,
        },
        payload => {
          qc.invalidateQueries({ queryKey: KEY });
          toast({ title: (payload.new as NotificationRow).title });
        }
      )
      // Marcadas como lidas noutro sítio: atualiza o contador (sem aviso).
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.userId}`,
        },
        () => qc.invalidateQueries({ queryKey: KEY })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, user.userId, qc]);

  const items = useMemo(() => (isPreview ? demo : (live.data ?? [])), [isPreview, demo, live.data]);
  const unread = items.filter(item => !item.read_at).length;

  const markRead = useCallback(
    async (ids: string[]) => {
      if (isPreview) {
        const at = new Date().toISOString();
        return setDemo(list => list.map(n => (ids.includes(n.id) ? { ...n, read_at: at } : n)));
      }
      // Lidas na hora; o servidor confirma em fundo.
      const at = new Date().toISOString();
      qc.setQueryData<typeof live.data>(KEY, list =>
        list?.map(n => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n))
      );
      const { error } = await notificationService.markRead(ids);
      if (error) void qc.invalidateQueries({ queryKey: KEY });
    },
    [isPreview, qc]
  );

  return {
    items,
    unread,
    messagesUnread: messenger?.unreadTotal ?? 0,
    noticesUnread,
    /** Total do sino: notificações + comunicados por confirmar (as mensagens têm contador próprio). */
    badge: unread + noticesUnread,
    markRead,
    markAllRead: () => markRead(items.filter(item => !item.read_at).map(item => item.id)),
  };
};
