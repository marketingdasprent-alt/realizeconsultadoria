// Anexos do Webmail: o servidor lê a mensagem inteira a cada anexo (demora), por isso o que já
// foi buscado fica em memória nesta sessão — abrir, pré-visualizar, descarregar e reencaminhar
// o mesmo anexo só pede uma vez.
import { mailService, type MailError } from '../services/mailService';

export interface LoadedAttachment {
  filename: string;
  mime: string;
  blob: Blob;
}

const MAX_CACHED = 12;
const cache = new Map<string, Promise<LoadedAttachment>>();

const decode = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), char => char.charCodeAt(0));

export const loadAttachment = (
  accountId: string,
  messageId: string,
  attachmentId: string
): Promise<LoadedAttachment> => {
  const key = `${accountId}|${messageId}|${attachmentId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = mailService.attachment(accountId, messageId, attachmentId).then(result => {
    if (result.error || !result.data)
      throw result.error ?? ({ code: 'unavailable', message: '' } as MailError);
    const { filename, mime, base64 } = result.data;
    return { filename, mime, blob: new Blob([decode(base64) as BlobPart], { type: mime }) };
  });
  cache.set(key, pending);
  // Falhou: não fica em cache (a próxima tentativa volta a pedir).
  pending.catch(() => cache.delete(key));
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  return pending;
};

/** O anexo como ficheiro, para voltar a anexar (reencaminhar). */
export const attachmentFile = async (
  accountId: string,
  messageId: string,
  attachmentId: string
): Promise<File> => {
  const loaded = await loadAttachment(accountId, messageId, attachmentId);
  return new File([loaded.blob], loaded.filename, { type: loaded.mime });
};

export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text';

/** Como se mostra dentro do Realize (null = só descarregar). */
export const previewKind = (mime: string, filename: string): PreviewKind | null => {
  const type = mime.toLowerCase();
  const name = filename.toLowerCase();
  if (type === 'image/svg+xml' || name.endsWith('.svg')) return null; // pode conter scripts
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    /\.(txt|csv|log|md|json|xml)$/.test(name)
  )
    return 'text';
  return null;
};
