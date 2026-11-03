// Imagens das assinaturas dentro do email (cid:), em vez de links para o Storage: o Outlook
// bloqueia imagens externas e a assinatura aparecia como um quadrado vazio.

import { signatureImagesToCid, type RawInlineImage } from '../mail/mime.ts';
import { fetchWithTimeout } from './http.ts';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * HTML com as imagens das assinaturas trocadas por cid: e as imagens para juntar ao email.
 * Uma imagem que não descarregue fica como estava (link).
 */
export const embedSignatureImages = async (
  html: string
): Promise<{ html: string; inline: RawInlineImage[] }> => {
  const base = Deno.env.get('SUPABASE_URL');
  if (!base || !html.includes('/mail-signatures/')) return { html, inline: [] };
  const found = signatureImagesToCid(html, base);
  let out = found.html;
  const inline: RawInlineImage[] = [];
  await Promise.all(
    found.images.map(async image => {
      try {
        const res = await fetchWithTimeout(image.url, {});
        const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!res.ok || !mime.startsWith('image/') || bytes.byteLength > MAX_BYTES) throw 0;
        inline.push({ cid: image.cid, mime, content: bytes });
      } catch {
        out = out.split(`cid:${image.cid}`).join(image.url);
      }
    })
  );
  return { html: out, inline };
};
