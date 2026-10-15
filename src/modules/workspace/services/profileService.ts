// Fotografia de perfil do próprio utilizador (tabela user_profiles + bucket avatars).
import { supabase } from '@/integrations/supabase/client';

export const profileService = {
  /** Envia a nova foto, regista-a no perfil e apaga a anterior. */
  uploadAvatar: async (userId: string, blob: Blob, ext: string) => {
    const { data: current } = await supabase
      .from('user_profiles')
      .select('avatar_path')
      .eq('user_id', userId)
      .maybeSingle();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (uploadError) return { path: null, error: uploadError };
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, avatar_path: path, updated_at: new Date().toISOString() });
    if (error) return { path: null, error };
    if (current?.avatar_path) await supabase.storage.from('avatars').remove([current.avatar_path]);
    return { path, error: null };
  },

  removeAvatar: async (userId: string) => {
    const { data: current } = await supabase
      .from('user_profiles')
      .select('avatar_path')
      .eq('user_id', userId)
      .maybeSingle();
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, avatar_path: null, updated_at: new Date().toISOString() });
    if (!error && current?.avatar_path)
      await supabase.storage.from('avatars').remove([current.avatar_path]);
    return { error };
  },
};
