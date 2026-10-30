// "@" na lista de conversas (como no WhatsApp): conversas onde fui marcado e ainda não vi.
// Vem das notificações de menção por ler; abrir a conversa marca-as como lidas.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';

const KEY = ['chat', 'mention-badges'];

const conversationOf = (link: string | null) => link?.match(/[?&]c=([0-9a-f-]{36})/i)?.[1] ?? null;

export const useMentionBadges = (activeId: string | null) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_notifications')
        .select('id, link')
        .eq('user_id', user.userId)
        .eq('kind', 'mention')
        .is('read_at', null);
      return (data ?? []).map(row => ({ id: row.id, conversationId: conversationOf(row.link) }));
    },
    enabled: !isPreview,
    refetchInterval: 30_000,
  });

  // Abrir a conversa: as menções dela ficam vistas.
  const rows = query.data ?? [];
  const toClear = rows.filter(row => row.conversationId === activeId).map(row => row.id);
  const clearKey = toClear.join(',');
  useEffect(() => {
    if (!clearKey) return;
    void supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', clearKey.split(','))
      .is('read_at', null)
      .then(() => qc.invalidateQueries({ queryKey: KEY }));
  }, [clearKey, qc]);

  return new Set(rows.map(row => row.conversationId).filter((id): id is string => !!id));
};
