// Gmail API → formato do Webmail. `format=metadata` dá o resumo da lista; `format=full`
// dá a árvore MIME (partes com body.data em base64url ou body.attachmentId).

import { parseAddress, parseAddressList } from './address.ts';
import { decodeHtmlEntities, normalizeContentId } from './html.ts';
import { base64UrlDecode, decodeBytes, decodeHeaderValue, parseHeaderParams } from './mime.ts';
import type { MailAttachmentInfo, MailMessage, MailSummary } from './types.ts';

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: GmailMessagePart;
}

/** Imagem inline (Content-ID) referida no HTML por cid:. */
export interface GmailInlinePart {
  partId: string;
  contentId: string;
  mime: string;
  size: number;
  data: string | null;
  attachmentId: string | null;
}

export const gmailHeader = (headers: GmailHeader[] | undefined, name: string): string | null => {
  const wanted = name.toLowerCase();
  const found = headers?.find(h => h.name.toLowerCase() === wanted);
  return found ? found.value : null;
};

const decoded = (value: string | null): string | null =>
  value && value.includes('=?') ? decodeHeaderValue(value) : value;

const toIsoDate = (internalDate: string | undefined, dateHeader: string | null): string => {
  const ms = Number(internalDate);
  if (internalDate && Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
  return new Date(Number.isFinite(parsed) ? parsed : 0).toISOString();
};

/** Resumo para a lista (format=metadata com From, To, Subject, Date). */
export const parseGmailSummary = (message: GmailMessage): MailSummary => {
  const headers = message.payload?.headers;
  const labels = message.labelIds ?? [];
  const from = decoded(gmailHeader(headers, 'From'));
  return {
    id: message.id,
    thread_id: message.threadId ?? null,
    from: from ? parseAddress(from) : null,
    to: parseAddressList(decoded(gmailHeader(headers, 'To'))),
    subject: decoded(gmailHeader(headers, 'Subject'))?.trim() ?? '',
    snippet: decodeHtmlEntities(message.snippet ?? ''),
    date: toIsoDate(message.internalDate, gmailHeader(headers, 'Date')),
    unread: labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    // Em metadata não vêm as partes; multipart/mixed é o indicador habitual de anexos.
    has_attachments: (message.payload?.mimeType ?? '').toLowerCase() === 'multipart/mixed',
  };
};

/** Todas as partes da árvore MIME (pré-ordem, incluindo a raiz). */
export const flattenGmailParts = (payload: GmailMessagePart | undefined): GmailMessagePart[] => {
  if (!payload) return [];
  const out: GmailMessagePart[] = [];
  const walk = (part: GmailMessagePart) => {
    out.push(part);
    part.parts?.forEach(walk);
  };
  walk(payload);
  return out;
};

export const findGmailPart = (
  payload: GmailMessagePart | undefined,
  partId: string
): GmailMessagePart | null => flattenGmailParts(payload).find(p => p.partId === partId) ?? null;

const isAttachmentPart = (part: GmailMessagePart): boolean => {
  if (part.filename) return true;
  const disposition = parseHeaderParams(gmailHeader(part.headers, 'Content-Disposition'));
  return disposition.value === 'attachment';
};

/** Primeira parte text/html e text/plain que não sejam anexos. */
export const pickGmailBodyParts = (
  payload: GmailMessagePart | undefined
): { html: GmailMessagePart | null; text: GmailMessagePart | null } => {
  let html: GmailMessagePart | null = null;
  let text: GmailMessagePart | null = null;
  for (const part of flattenGmailParts(payload)) {
    if (isAttachmentPart(part)) continue;
    const mime = (part.mimeType ?? '').toLowerCase();
    if (mime === 'text/html' && !html) html = part;
    else if (mime === 'text/plain' && !text) text = part;
  }
  return { html, text };
};

/** Texto de uma parte (base64url) no charset do seu Content-Type. */
export const decodeGmailPartData = (part: GmailMessagePart, data?: string | null): string => {
  const raw = data ?? part.body?.data ?? '';
  const charset = parseHeaderParams(gmailHeader(part.headers, 'Content-Type')).params.charset;
  return decodeBytes(base64UrlDecode(raw), charset);
};

/** Imagens inline com Content-ID (para trocar cid: por data: no HTML). */
export const listGmailInlineParts = (payload: GmailMessagePart | undefined): GmailInlinePart[] =>
  flattenGmailParts(payload)
    .filter(p => (p.mimeType ?? '').toLowerCase().startsWith('image/') && p.partId)
    .map(p => ({ part: p, cid: gmailHeader(p.headers, 'Content-ID') }))
    .filter((x): x is { part: GmailMessagePart; cid: string } => !!x.cid)
    .map(({ part, cid }) => ({
      partId: part.partId as string,
      contentId: normalizeContentId(cid),
      mime: (part.mimeType ?? 'application/octet-stream').toLowerCase(),
      size: part.body?.size ?? 0,
      data: part.body?.data ?? null,
      attachmentId: part.body?.attachmentId ?? null,
    }));

/** Anexos (id = partId, estável entre pedidos; o attachmentId do Gmail muda a cada leitura). */
export const listGmailAttachments = (
  payload: GmailMessagePart | undefined,
  excludePartIds: Set<string> = new Set()
): MailAttachmentInfo[] =>
  flattenGmailParts(payload)
    .filter(p => p.filename && p.partId && !excludePartIds.has(p.partId))
    .map(p => ({
      id: p.partId as string,
      filename: decoded(p.filename ?? '') ?? 'anexo',
      mime: (p.mimeType ?? 'application/octet-stream').toLowerCase(),
      size: p.body?.size ?? 0,
    }));

export interface GmailBodyOverrides {
  /** Corpo já obtido à parte (partes grandes vêm só com attachmentId). */
  html?: string | null;
  text?: string | null;
  /** Partes inline já embebidas no HTML (não aparecem como anexos). */
  excludePartIds?: Set<string>;
}

/** Mensagem completa (format=full). */
export const parseGmailMessage = (
  message: GmailMessage,
  overrides: GmailBodyOverrides = {}
): MailMessage => {
  const headers = message.payload?.headers;
  const bodies = pickGmailBodyParts(message.payload);
  const html =
    overrides.html !== undefined
      ? overrides.html
      : bodies.html?.body?.data
        ? decodeGmailPartData(bodies.html)
        : null;
  const text =
    overrides.text !== undefined
      ? overrides.text
      : bodies.text?.body?.data
        ? decodeGmailPartData(bodies.text)
        : null;
  const attachments = listGmailAttachments(message.payload, overrides.excludePartIds);

  return {
    ...parseGmailSummary(message),
    has_attachments: attachments.length > 0,
    cc: parseAddressList(decoded(gmailHeader(headers, 'Cc'))),
    reply_to: parseAddressList(decoded(gmailHeader(headers, 'Reply-To'))),
    html,
    text,
    attachments,
    message_id_header: gmailHeader(headers, 'Message-ID'),
    references: gmailHeader(headers, 'References'),
  };
};
