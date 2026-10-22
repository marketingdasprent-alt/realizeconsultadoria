// Rascunhos: abrir um guardado na pasta Rascunhos para continuar a escrever.
import { htmlToText } from './mailFormat';
import { signatureToHtml } from './signature';
import type { ComposeDraft, MailAddress, MailMessage, MailSignature } from '../types';

const list = (addresses: MailAddress[]) => addresses.map(a => a.email).join(', ');

/** O rascunho guardado volta ao compositor: destinatários, assunto, texto e anexos. */
export const draftFromSaved = (message: MailMessage): ComposeDraft => ({
  accountId: message.accountId,
  to: list(message.to),
  cc: list(message.cc),
  subject: message.subject,
  body: (message.text ?? htmlToText(message.html ?? '')).replace(/\s+$/, ''),
  saved: {
    messageId: message.id,
    accountId: message.accountId,
    attachments: message.attachments,
  },
});

/** Algo que valha a pena guardar como rascunho. */
export const draftHasContent = (
  fields: { to: string; cc: string; bcc: string; subject: string; body: string },
  fileCount: number
): boolean => fileCount > 0 || Object.values(fields).some(value => value.trim().length > 0);

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Rascunho reaberto: a assinatura veio como texto no corpo (sem imagens). Se for uma das
 * assinaturas da caixa, sai do texto e volta a ser escolhida no seletor (aparece completa).
 */
export const stripSavedSignature = (
  written: string,
  signatures: MailSignature[]
): { body: string; signatureId: string | null } => {
  for (const signature of signatures) {
    const text = htmlToText(signatureToHtml(signature.html)).trim();
    const firstLine = text
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);
    if (!firstLine) continue;
    const at = written.lastIndexOf(firstLine);
    if (at < 0) continue;
    const wanted = squash(text);
    if (!squash(written.slice(at)).startsWith(wanted.slice(0, Math.min(wanted.length, 60))))
      continue;
    return { body: written.slice(0, at).replace(/\s*(--)?\s*$/, ''), signatureId: signature.id };
  }
  return { body: written, signatureId: null };
};
