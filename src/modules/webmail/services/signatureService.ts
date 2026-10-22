// Imagens das assinaturas: bucket público "mail-signatures", pasta de cada pessoa.
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'mail-signatures';
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const SIGNATURE_IMAGE_MAX = 5 * 1024 * 1024;

/** Envia uma imagem e devolve o endereço público (o que vai no HTML da assinatura). */
export const uploadSignatureImage = async (
  file: File
): Promise<{ url: string | null; error: string | null }> => {
  if (!TYPES.includes(file.type))
    return { url: null, error: 'Use uma imagem PNG, JPG, GIF ou WebP.' };
  if (file.size > SIGNATURE_IMAGE_MAX) return { url: null, error: 'A imagem tem mais de 5 MB.' };
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return { url: null, error: 'A sessão terminou. Entre outra vez.' };
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) return { url: null, error: 'A imagem não foi enviada.' };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, error: null };
};
