// Corpo JSON das mensagens enviadas pelo Microsoft Graph (sendMail, reply, rascunhos).

import type { MailAddress, OutgoingAttachment } from './types.ts';

/** Pedidos JSON do Graph até 4 MB; acima disto os anexos vão por sessão de upload. */
export const GRAPH_INLINE_ATTACHMENTS_LIMIT = 3 * 1024 * 1024;

/** Pedaços da sessão de upload: múltiplos de 320 KiB e < 4 MB, como o Graph exige. */
export const GRAPH_UPLOAD_CHUNK = 320 * 1024 * 9;

export interface GraphRecipientPayload {
  emailAddress: { address: string; name?: string };
}

export const toGraphRecipients = (addresses: MailAddress[]): GraphRecipientPayload[] =>
  addresses.map(a => ({
    emailAddress: a.name ? { address: a.email, name: a.name } : { address: a.email },
  }));

export interface GraphFileAttachmentPayload {
  '@odata.type': '#microsoft.graph.fileAttachment';
  name: string;
  contentType: string;
  contentBytes: string;
}

export const toGraphAttachment = (a: OutgoingAttachment): GraphFileAttachmentPayload => ({
  '@odata.type': '#microsoft.graph.fileAttachment',
  name: a.filename,
  contentType: a.mime || 'application/octet-stream',
  contentBytes: a.base64,
});

export interface GraphOutgoing {
  subject: string;
  html: string;
  /** Usado quando não há HTML. */
  text?: string;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  attachments?: OutgoingAttachment[];
}

/** Objeto `message` do Graph: corpo HTML (ou texto se não houver HTML), anexos se vierem. */
export const buildGraphMessage = (m: GraphOutgoing): Record<string, unknown> => {
  const message: Record<string, unknown> = {
    subject: m.subject,
    body: m.html.trim()
      ? { contentType: 'HTML', content: m.html }
      : { contentType: 'Text', content: m.text ?? '' },
    toRecipients: toGraphRecipients(m.to),
    ccRecipients: toGraphRecipients(m.cc),
    bccRecipients: toGraphRecipients(m.bcc),
  };
  if (m.attachments?.length) message.attachments = m.attachments.map(toGraphAttachment);
  return message;
};

/** Anexo pequeno o suficiente para um POST JSON (base64 + margem abaixo dos 4 MB). */
export const GRAPH_SMALL_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;

/** Corpo + anexos cabem num só pedido JSON ao Graph? */
export const fitsInlineGraphRequest = (
  attachments: OutgoingAttachment[],
  bodyLength = 0
): boolean =>
  attachments.reduce((sum, a) => sum + a.base64.length, bodyLength) <=
  GRAPH_INLINE_ATTACHMENTS_LIMIT;

/** Intervalos [start, end] (inclusivos) para os PUT da sessão de upload. */
export const graphUploadRanges = (
  totalBytes: number,
  chunk = GRAPH_UPLOAD_CHUNK
): { start: number; end: number }[] => {
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < totalBytes; start += chunk) {
    ranges.push({ start, end: Math.min(start + chunk, totalBytes) - 1 });
  }
  return ranges;
};
