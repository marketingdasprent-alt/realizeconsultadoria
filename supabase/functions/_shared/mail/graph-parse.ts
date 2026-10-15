// Microsoft Graph (mensagens do Outlook/Microsoft 365) → formato do Webmail.

import { decodeHtmlEntities } from './html.ts';
import type { MailAddress, MailAttachmentInfo, MailMessage, MailSummary } from './types.ts';

export interface GraphRecipient {
  emailAddress?: { name?: string | null; address?: string | null } | null;
}

export interface GraphMessage {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  lastModifiedDateTime?: string | null;
  createdDateTime?: string | null;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  flag?: { flagStatus?: string | null } | null;
  from?: GraphRecipient | null;
  sender?: GraphRecipient | null;
  toRecipients?: GraphRecipient[] | null;
  ccRecipients?: GraphRecipient[] | null;
  replyTo?: GraphRecipient[] | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  internetMessageId?: string | null;
  internetMessageHeaders?: { name: string; value: string }[] | null;
}

export interface GraphAttachment {
  '@odata.type'?: string;
  id: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
  isInline?: boolean | null;
  contentId?: string | null;
  contentBytes?: string | null;
}

/** Destinatário do Graph → MailAddress (o Graph repete o email no nome quando não há nome). */
export const graphRecipient = (
  recipient: GraphRecipient | null | undefined
): MailAddress | null => {
  const email = recipient?.emailAddress?.address?.trim();
  if (!email) return null;
  const name = recipient?.emailAddress?.name?.trim();
  return { name: name && name.toLowerCase() !== email.toLowerCase() ? name : null, email };
};

const recipients = (list: GraphRecipient[] | null | undefined): MailAddress[] =>
  (list ?? []).map(graphRecipient).filter((a): a is MailAddress => a !== null);

const graphDate = (m: GraphMessage): string => {
  const raw = m.receivedDateTime ?? m.sentDateTime ?? m.lastModifiedDateTime ?? m.createdDateTime;
  const ms = raw ? Date.parse(raw) : NaN;
  return new Date(Number.isFinite(ms) ? ms : 0).toISOString();
};

export const parseGraphSummary = (m: GraphMessage): MailSummary => ({
  id: m.id,
  thread_id: m.conversationId ?? null,
  from: graphRecipient(m.from) ?? graphRecipient(m.sender),
  to: recipients(m.toRecipients),
  subject: m.subject?.trim() ?? '',
  snippet: decodeHtmlEntities(m.bodyPreview ?? '')
    .replace(/\s+/g, ' ')
    .trim(),
  date: graphDate(m),
  // Rascunhos vêm como não lidos no Graph; na lista não faz sentido destacá-los.
  unread: m.isRead === false && !m.isDraft,
  starred: m.flag?.flagStatus === 'flagged',
  has_attachments: !!m.hasAttachments,
});

export const graphHeader = (m: GraphMessage, name: string): string | null => {
  const wanted = name.toLowerCase();
  return m.internetMessageHeaders?.find(h => h.name.toLowerCase() === wanted)?.value ?? null;
};

export const graphAttachmentInfo = (a: GraphAttachment): MailAttachmentInfo => {
  const isItem = a['@odata.type'] === '#microsoft.graph.itemAttachment';
  const name = a.name?.trim() || 'anexo';
  return {
    id: a.id,
    // Email anexado (itemAttachment): descarrega-se como .eml.
    filename: isItem && !/\.eml$/i.test(name) ? `${name}.eml` : name,
    mime: isItem ? 'message/rfc822' : (a.contentType ?? 'application/octet-stream').toLowerCase(),
    size: a.size ?? 0,
  };
};

export interface GraphMessageOverrides {
  /** HTML com as imagens inline já embebidas. */
  html?: string | null;
  /** Anexos inline já embebidos no HTML (não aparecem como anexos). */
  excludeAttachmentIds?: Set<string>;
}

/** Mensagem completa: o corpo vem em html ou text conforme body.contentType. */
export const parseGraphMessage = (
  m: GraphMessage,
  attachments: GraphAttachment[] = [],
  overrides: GraphMessageOverrides = {}
): MailMessage => {
  const isHtml = (m.body?.contentType ?? '').toLowerCase() === 'html';
  const content = m.body?.content ?? null;
  const exclude = overrides.excludeAttachmentIds ?? new Set<string>();
  const list = attachments.filter(a => !exclude.has(a.id)).map(graphAttachmentInfo);
  return {
    ...parseGraphSummary(m),
    has_attachments: list.length > 0 || (!!m.hasAttachments && attachments.length === 0),
    cc: recipients(m.ccRecipients),
    reply_to: recipients(m.replyTo),
    html: overrides.html !== undefined ? overrides.html : isHtml ? content : null,
    text: isHtml ? null : content,
    attachments: list,
    message_id_header: m.internetMessageId ?? graphHeader(m, 'Message-ID'),
    references: graphHeader(m, 'References'),
  };
};
