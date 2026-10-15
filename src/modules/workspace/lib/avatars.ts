// Fotografias de perfil: bucket público "avatars", ficheiro "<user_id>/<data>.<ext>".
import { supabase } from '@/integrations/supabase/client';

export const AVATAR_SIZE = 512;
export const AVATAR_MAX_INPUT = 15 * 1024 * 1024;

export const avatarUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    image.src = url;
  });

/**
 * Recorta ao centro em quadrado e reduz para 512 px: as fotos do telemóvel têm vários MB e
 * no avatar só se veem pequenas. WebP quando o browser o gera, senão JPEG.
 */
export const prepareAvatar = async (file: File): Promise<{ blob: Blob; ext: string }> => {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  if (file.size > AVATAR_MAX_INPUT) throw new Error('A imagem tem mais de 15 MB.');
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const size = Math.min(AVATAR_SIZE, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem.');
  ctx.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  );
  const toBlob = (type: string) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.85));
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('Não foi possível preparar a imagem.');
  return { blob: jpeg, ext: 'jpg' };
};
