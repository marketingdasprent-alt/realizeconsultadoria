// Apreciações no Supabase. Públicas: a empresa vê; privadas: só quem envia e quem recebe.
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { NewAppreciationInput } from '../types';

// As reações vêm junto (uma só consulta); o RLS mostra só as dos reconhecimentos visíveis.
const WITH_REACTIONS = '*, appreciation_reactions(user_id, emoji, created_at)';

export type AppreciationRow = Database['public']['Tables']['appreciations']['Row'] & {
  appreciation_reactions: { user_id: string; emoji: string; created_at: string }[];
};

export const appreciationService = {
  /** Recebidas e enviadas por um utilizador (as que o utilizador atual pode ver). */
  listForUser: async (userId: string) => {
    const { data, error } = await supabase
      .from('appreciations')
      .select(WITH_REACTIONS)
      .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(200);
    return { data: data ?? [], error };
  },

  /** Reconhecimentos públicos recentes da empresa (para o Feed). */
  listRecentPublic: async (limit = 30) => {
    const { data, error } = await supabase
      .from('appreciations')
      .select(WITH_REACTIONS)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: data ?? [], error };
  },

  send: async (companyId: string, senderId: string, input: NewAppreciationInput) => {
    const { error } = await supabase.from('appreciations').insert({
      company_id: companyId,
      sender_id: senderId,
      recipient_id: input.recipientId,
      kind: input.kind,
      message: input.message.trim() || null,
      is_public: input.isPublic,
    });
    return { error };
  },

  addReaction: async (appreciationId: string, userId: string, emoji: string) => {
    const { error } = await supabase
      .from('appreciation_reactions')
      .insert({ appreciation_id: appreciationId, user_id: userId, emoji });
    return { error };
  },

  removeReaction: async (appreciationId: string, userId: string, emoji: string) => {
    const { error } = await supabase
      .from('appreciation_reactions')
      .delete()
      .match({ appreciation_id: appreciationId, user_id: userId, emoji });
    return { error };
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('appreciations').delete().eq('id', id);
    return { error };
  },
};
