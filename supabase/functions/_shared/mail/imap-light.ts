// Abrir um email IMAP grande sem descarregar os anexos: a partir da estrutura (BODYSTRUCTURE)
// escolhem-se o texto, o HTML e as imagens pequenas da assinatura (cid:), que se descarregam;
// os anexos ficam na lista com o id "p:<parte>" e só se descarregam quando se abrem.

import { htmlToText, makeSnippet } from './html.ts';
import { imapAddresses, type ImapAddressLike, type ImapBodyNode } from './imap-parse.ts';
import { messageKey } from './labels.ts';
import { bytesToBase64, decodeBytes, decodeTransferEncoding } from './mime.ts';
import type { MailAttachmentInfo, MailMessage } from './types.ts';

/**
 * Imagens embebidas (cid:) que se descarregam já: cada uma e no total (tamanho em base64).
 * Assinaturas com imagens de 1–2 MB ficavam em branco nos Enviados com o limite de 300 KB.
 */
const INLINE_MAX = 2.5 * 1024 * 1024;
const INLINE_TOTAL_MAX = 4 * 1024 * 1024;

/** Prefixo do id dos anexos de um email aberto pelo caminho leve. */
export const PART_ATTACHMENT_PREFIX = 'p:';

export interface LightPart {
  part: string;
  mime: string;
  encoding: string | null;
  charset: string | null;
  size: number;
}

export interface LightPlan {
  text: LightPart | null;
  html: LightPart | null;
  /** Imagens embebidas no HTML (Content-ID sem <>). */
  inline: (LightPart & { cid: string })[];
  attachments: MailAttachmentInfo[];
}

type Node = ImapBodyNode & { id?: string };

const isEmbeddedMail = (node: Node) => (node.type ?? '').toLowerCase() === 'message/rfc822';

// Um email dentro do email (aviso de devolução, "reencaminhar como anexo") é um anexo: não se
// entra nele — antes o leitor mostrava o HTML do email embebido em vez do aviso.
const leaves = (root: Node | undefined): Node[] =>
  !root
    ? []
    : root.childNodes?.length && !isEmbeddedMail(root)
      ? root.childNodes.flatMap(leaves)
      : [root];

const toPart = (node: Node): LightPart => ({
  // Numa mensagem sem multipart o corpo é a parte "1".
  part: node.part ?? '1',
  mime: (node.type ?? 'application/octet-stream').toLowerCase(),
  encoding: node.encoding ?? null,
  charset: node.parameters?.charset ?? null,
  size: node.size ?? 0,
});

const filenameOf = (node: Node) =>
  node.dispositionParameters?.filename ?? node.parameters?.name ?? null;

/** O que descarregar (e o que fica só na lista) a partir da estrutura do email. */
export const planLightMessage = (root: ImapBodyNode | undefined): LightPlan => {
  const plan: LightPlan = { text: null, html: null, inline: [], attachments: [] };
  let inlineTotal = 0;
  for (const node of leaves(root as Node)) {
    const mime = (node.type ?? '').toLowerCase();
    const disposition = node.disposition?.toLowerCase();
    const cid = node.id?.replace(/^<|>$/g, '').trim();
    const filename = filenameOf(node);
    if (disposition !== 'attachment' && !filename && mime === 'text/plain' && !plan.text) {
      plan.text = toPart(node);
    } else if (disposition !== 'attachment' && !filename && mime === 'text/html' && !plan.html) {
      plan.html = toPart(node);
    } else if (isEmbeddedMail(node)) {
      plan.attachments.push({
        id: `${PART_ATTACHMENT_PREFIX}${node.part ?? '1'}`,
        filename: filename?.trim() || 'mensagem.eml',
        mime: 'message/rfc822',
        size: node.size ?? 0,
      });
    } else if (
      cid &&
      mime.startsWith('image/') &&
      disposition !== 'attachment' &&
      (node.size ?? 0) <= INLINE_MAX &&
      inlineTotal + (node.size ?? 0) <= INLINE_TOTAL_MAX
    ) {
      inlineTotal += node.size ?? 0;
      plan.inline.push({ ...toPart(node), cid });
      // Fotografia com nome (iPhone/Apple Mail): também se pode descarregar e reencaminhar.
      // Só as grandes: os logótipos das assinaturas (image001.png, poucos KB) não são anexos.
      if (filename && (node.size ?? 0) > 150 * 1024)
        plan.attachments.push({
          id: `${PART_ATTACHMENT_PREFIX}${node.part ?? '1'}`,
          filename: filename.trim(),
          mime,
          size:
            node.encoding?.toLowerCase() === 'base64'
              ? Math.floor(((node.size ?? 0) * 3) / 4)
              : (node.size ?? 0),
        });
    } else if (!mime.startsWith('multipart/') && (filename || disposition === 'attachment')) {
      plan.attachments.push({
        id: `${PART_ATTACHMENT_PREFIX}${node.part ?? '1'}`,
        filename: filename?.trim() || 'anexo',
        mime: mime || 'application/octet-stream',
        // A estrutura dá o tamanho em base64 (cerca de 4/3 do ficheiro)
        size:
          node.encoding?.toLowerCase() === 'base64'
            ? Math.floor(((node.size ?? 0) * 3) / 4)
            : (node.size ?? 0),
      });
    }
  }
  return plan;
};

interface LightEnvelope {
  date?: Date | string;
  subject?: string;
  from?: ImapAddressLike[];
  to?: ImapAddressLike[];
  cc?: ImapAddressLike[];
  replyTo?: ImapAddressLike[];
  messageId?: string;
}

const hasFlag = (flags: Iterable<string> | undefined, flag: string): boolean => {
  for (const f of flags ?? []) if (f.toLowerCase() === flag.toLowerCase()) return true;
  return false;
};

/**
 * Primeira data válida (cabeçalho Date, depois a chegada ao servidor): um Date mal escrito vem
 * como texto e antes dava 01/01/1970 em vez de usar a hora de chegada.
 */
const toIso = (...values: (Date | string | undefined | null)[]): string => {
  for (const value of values) {
    const ms = value instanceof Date ? value.getTime() : value ? Date.parse(value) : NaN;
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  }
  return new Date(0).toISOString();
};

const decodePart = (bytes: Uint8Array | undefined, part: LightPart) =>
  bytes ? decodeBytes(decodeTransferEncoding(bytes, part.encoding), part.charset) : '';

/** Monta o email a partir das partes descarregadas (as imagens cid: passam a data: URLs). */
export const buildLightMessage = (input: {
  id: string;
  plan: LightPlan;
  envelope?: LightEnvelope;
  flags?: Iterable<string>;
  internalDate?: Date | string;
  references?: string | null;
  read: (part: string) => Uint8Array | undefined;
}): MailMessage => {
  const { plan } = input;
  const text = plan.text ? decodePart(input.read(plan.text.part), plan.text) : null;
  let html = plan.html ? decodePart(input.read(plan.html.part), plan.html) : null;
  if (html) {
    for (const image of plan.inline) {
      const bytes = input.read(image.part);
      if (!bytes) continue;
      const data = `data:${image.mime};base64,${bytesToBase64(decodeTransferEncoding(bytes, image.encoding))}`;
      html = html.split(`cid:${image.cid}`).join(data);
    }
  }
  const env = input.envelope;
  return {
    id: input.id,
    thread_id: null,
    from: imapAddresses(env?.from)[0] ?? null,
    to: imapAddresses(env?.to),
    subject: env?.subject?.trim() ?? '',
    snippet: makeSnippet(text ?? (html ? htmlToText(html) : '')),
    date: toIso(env?.date, input.internalDate),
    unread: !hasFlag(input.flags, '\\Seen'),
    starred: hasFlag(input.flags, '\\Flagged'),
    has_attachments: plan.attachments.length > 0,
    cc: imapAddresses(env?.cc),
    reply_to: imapAddresses(env?.replyTo),
    html: html || null,
    text: text || null,
    attachments: plan.attachments,
    message_key: messageKey(env?.messageId),
    message_id_header: env?.messageId ?? null,
    references: input.references ?? null,
  };
};
