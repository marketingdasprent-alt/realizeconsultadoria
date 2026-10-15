// IMAP (imapflow + mailparser) → formato do Webmail. Tipos estruturais mínimos, para
// os testes não dependerem dos pacotes npm.

import { htmlToText, makeSnippet } from './html.ts';
import { decodeBytes, decodeTransferEncoding } from './mime.ts';
import type { MailAddress, MailAttachmentInfo, MailMessage, MailSummary } from './types.ts';

export interface ImapAddressLike {
  name?: string;
  address?: string;
  group?: ImapAddressLike[];
}

export interface ImapEnvelopeLike {
  date?: Date | string;
  subject?: string;
  from?: ImapAddressLike[];
  to?: ImapAddressLike[];
  messageId?: string;
}

export interface ImapBodyNode {
  part?: string;
  type?: string;
  parameters?: Record<string, string>;
  encoding?: string;
  size?: number;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  childNodes?: ImapBodyNode[];
}

/** Endereços IMAP/mailparser (inclui grupos) → MailAddress[]. */
export const imapAddresses = (list: ImapAddressLike[] | undefined): MailAddress[] => {
  const out: MailAddress[] = [];
  for (const a of list ?? []) {
    if (a.group?.length) {
      out.push(...imapAddresses(a.group));
      continue;
    }
    const email = a.address?.trim();
    if (!email) continue;
    const name = a.name?.trim();
    out.push({ name: name && name.toLowerCase() !== email.toLowerCase() ? name : null, email });
  }
  return out;
};

/** Todos os nós da BODYSTRUCTURE (pré-ordem, incluindo a raiz). */
const flatten = (root: ImapBodyNode | undefined): ImapBodyNode[] =>
  root ? [root, ...(root.childNodes ?? []).flatMap(flatten)] : [];

const isAttachmentNode = (n: ImapBodyNode): boolean =>
  n.disposition?.toLowerCase() === 'attachment' ||
  (!n.type?.toLowerCase().startsWith('multipart/') &&
    !n.type?.toLowerCase().startsWith('text/') &&
    !!(n.dispositionParameters?.filename || n.parameters?.name));

export const imapHasAttachments = (root: ImapBodyNode | undefined): boolean =>
  flatten(root).some(isAttachmentNode);

export interface ImapSnippetPart {
  part: string;
  encoding: string | null;
  charset: string | null;
  html: boolean;
  size: number;
}

/** Parte de texto a usar na pré-visualização (text/plain, senão text/html). */
export const pickImapSnippetPart = (root: ImapBodyNode | undefined): ImapSnippetPart | null => {
  const bodies = flatten(root).filter(n => !isAttachmentNode(n));
  const node =
    bodies.find(n => n.type?.toLowerCase() === 'text/plain') ??
    bodies.find(n => n.type?.toLowerCase() === 'text/html');
  if (!node) return null;
  return {
    // Numa mensagem sem multipart o corpo é a parte "1".
    part: node.part ?? '1',
    encoding: node.encoding ?? null,
    charset: node.parameters?.charset ?? null,
    html: node.type?.toLowerCase() === 'text/html',
    size: node.size ?? 0,
  };
};

/** Bytes da parte (ainda com transfer-encoding) → pré-visualização numa linha. */
export const imapSnippet = (bytes: Uint8Array, info: ImapSnippetPart): string => {
  const text = decodeBytes(decodeTransferEncoding(bytes, info.encoding), info.charset);
  return makeSnippet(info.html ? htmlToText(text) : text);
};

const toIso = (value: Date | string | undefined | null): string => {
  const ms = value instanceof Date ? value.getTime() : value ? Date.parse(value) : NaN;
  return new Date(Number.isFinite(ms) ? ms : 0).toISOString();
};

const hasFlag = (flags: Iterable<string> | undefined, flag: string): boolean => {
  for (const f of flags ?? []) if (f.toLowerCase() === flag.toLowerCase()) return true;
  return false;
};

export const imapSummary = (input: {
  id: string;
  envelope?: ImapEnvelopeLike;
  flags?: Iterable<string>;
  internalDate?: Date | string;
  bodyStructure?: ImapBodyNode;
  snippet?: string;
}): MailSummary => {
  const from = imapAddresses(input.envelope?.from)[0] ?? null;
  return {
    id: input.id,
    thread_id: null,
    from,
    to: imapAddresses(input.envelope?.to),
    subject: input.envelope?.subject?.trim() ?? '',
    snippet: input.snippet ?? '',
    date: toIso(input.envelope?.date ?? input.internalDate),
    unread: !hasFlag(input.flags, '\\Seen'),
    starred: hasFlag(input.flags, '\\Flagged'),
    has_attachments: imapHasAttachments(input.bodyStructure),
  };
};

export interface ParsedAddressObjectLike {
  value?: ImapAddressLike[];
}

export interface ParsedAttachmentLike {
  filename?: string;
  contentType?: string;
  size?: number;
  /** mailparser: imagem de multipart/related já embebida no HTML como data: URL. */
  related?: boolean;
}

export interface ParsedMailLike {
  subject?: string;
  from?: ParsedAddressObjectLike;
  to?: ParsedAddressObjectLike | ParsedAddressObjectLike[];
  cc?: ParsedAddressObjectLike | ParsedAddressObjectLike[];
  replyTo?: ParsedAddressObjectLike | ParsedAddressObjectLike[];
  date?: Date;
  html?: string | false;
  text?: string;
  attachments?: ParsedAttachmentLike[];
  messageId?: string;
  references?: string | string[];
}

const parsedAddresses = (
  value: ParsedAddressObjectLike | ParsedAddressObjectLike[] | undefined
): MailAddress[] =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap(v => imapAddresses(v.value));

/** Anexos visíveis: id = índice no array do mailparser (estável para a mesma mensagem). */
export const parsedAttachments = (parsed: ParsedMailLike): MailAttachmentInfo[] =>
  (parsed.attachments ?? [])
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => !a.related)
    .map(({ a, index }) => ({
      id: String(index),
      filename: a.filename?.trim() || 'anexo',
      mime: (a.contentType ?? 'application/octet-stream').toLowerCase(),
      size: a.size ?? 0,
    }));

/** Mensagem completa a partir do mailparser (simpleParser) + flags IMAP. */
export const parsedMailToMessage = (
  parsed: ParsedMailLike,
  meta: { id: string; flags?: Iterable<string>; internalDate?: Date | string }
): MailMessage => {
  const html = typeof parsed.html === 'string' && parsed.html ? parsed.html : null;
  const text = parsed.text ?? null;
  const attachments = parsedAttachments(parsed);
  const references = Array.isArray(parsed.references)
    ? parsed.references.join(' ')
    : (parsed.references ?? null);
  return {
    id: meta.id,
    thread_id: null,
    from: parsedAddresses(parsed.from)[0] ?? null,
    to: parsedAddresses(parsed.to),
    subject: parsed.subject?.trim() ?? '',
    snippet: makeSnippet(text ?? (html ? htmlToText(html) : '')),
    date: toIso(parsed.date ?? meta.internalDate),
    unread: !hasFlag(meta.flags, '\\Seen'),
    starred: hasFlag(meta.flags, '\\Flagged'),
    has_attachments: attachments.length > 0,
    cc: parsedAddresses(parsed.cc),
    reply_to: parsedAddresses(parsed.replyTo),
    html,
    text,
    attachments,
    message_id_header: parsed.messageId ?? null,
    references,
  };
};
