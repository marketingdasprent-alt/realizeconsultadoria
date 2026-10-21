import { supabase } from '@/integrations/supabase/client';

export const profileService = {
  /** Fotografias de perfil (caminho no bucket "avatars") de quem já pôs uma, por utilizador. */
  getAvatarPaths: async (): Promise<{
    data: { user_id: string; avatar_path: string }[] | null;
    error: unknown;
  }> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, avatar_path')
      .not('avatar_path', 'is', null);
    return { data: (data ?? []) as { user_id: string; avatar_path: string }[], error };
  },
};
