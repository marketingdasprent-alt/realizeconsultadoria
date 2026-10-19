import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Quem está online na empresa (Supabase Realtime Presence): cada sessão aberta anuncia
 * o seu utilizador num canal da empresa. Só circula o id do utilizador.
 */
export const usePresence = (companyId: string | null, userId: string | null): Set<string> => {
  const [online, setOnline] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!companyId || !userId) return;
    const channel = supabase.channel(`chat-presence-${companyId}`, {
      // Privado: só os colegas ativos da empresa (regras em realtime.messages).
      config: { private: true, presence: { key: userId } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') channel.track({ at: new Date().toISOString() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, userId]);

  return online;
};
