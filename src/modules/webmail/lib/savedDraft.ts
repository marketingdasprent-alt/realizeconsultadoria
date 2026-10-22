// Rascunhos: abrir um guardado na pasta Rascunhos para continuar a escrever.
import { htmlToText } from './mailFormat';
import type { ComposeDraft, MailAddress, MailMessage } from '../types';

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
