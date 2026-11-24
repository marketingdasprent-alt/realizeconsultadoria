// Imagens dentro dos emails (cid: → data:) com a origem marcada, para que o envio as volte a
// buscar à caixa em vez de as receber escritas no HTML (contrato: docs/webmail-imagens-citadas.md).
//
// Os drivers não conhecem a conta: marcam cada imagem só com o id da parte (`rz-part`), e o
// handler troca essa marca pelo token final (`rz-src`, conta + mensagem + parte) ao abrir o email.

import { base64UrlDecodeToString, base64UrlEncode } from './mime.ts';

const SAFE = /^[A-Za-z0-9_-]+$/;
const MAX_TOKEN = 6000;

/** data URL com a marca da parte (id que `driver.attachment(messageId, id)` aceita). */
export const partMarkedDataUrl = (mime: string, base64: string, partId: string | null): string =>
  partId
    ? `data:${mime};rz-part=${base64UrlEncode(partId)};base64,${base64}`
    : `data:${mime};base64,${base64}`;

/** Token da imagem: base64url (sem `=`) de `accountId\nmessageId\nattachmentId`. */
export const encodeImageToken = (accountId: string, messageId: string, attachmentId: string) =>
  base64UrlEncode(`${accountId}\n${messageId}\n${attachmentId}`);

export interface ImageSource {
  accountId: string;
  messageId: string;
  attachmentId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Token → origem (null se mal formado). */
export const decodeImageToken = (token: string): ImageSource | null => {
  if (!token || token.length > MAX_TOKEN || !SAFE.test(token)) return null;
  let text: string;
  try {
    text = base64UrlDecodeToString(token);
  } catch {
    return null;
  }
  const parts = text.split('\n');
  if (parts.length !== 3) return null;
  const [accountId, messageId, attachmentId] = parts;
  if (!UUID.test(accountId) || !messageId || messageId.length > 2000) return null;
  if (!attachmentId || attachmentId.length > 1000 || /[\r\0]/.test(messageId + attachmentId))
    return null;
  return { accountId, messageId, attachmentId };
};

/**
 * `rz-part=<id da parte>` → `rz-src=<token>` no HTML de um email aberto. Uma marca que não se
 * consiga ler sai (a imagem fica como hoje, sem marca).
 */
export const markInlineImages = (html: string, accountId: string, messageId: string): string =>
  html.includes(';rz-part=')
    ? html.replace(/;rz-part=([A-Za-z0-9_-]+);base64,/g, (_all, encoded: string) => {
        try {
          const partId = base64UrlDecodeToString(encoded);
          return `;rz-src=${encodeImageToken(accountId, messageId, partId)};base64,`;
        } catch {
          return ';base64,';
        }
      })
    : html;

export interface InlineImageRef {
  token: string;
  cid: string;
}

/** Máximo de imagens citadas por envio. */
export const MAX_INLINE_IMAGES = 100;
const CID = /^[A-Za-z0-9._@-]{1,100}$/;

/**
 * Campo `inline_images` do pedido: ausente → []; mal formado → null (pedido inválido).
 * O mesmo cid repetido conta uma vez (fica o primeiro).
 */
export const parseInlineImages = (raw: unknown): InlineImageRef[] | null => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_INLINE_IMAGES) return null;
  const out: InlineImageRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { token, cid } = item as Record<string, unknown>;
    if (typeof token !== 'string' || token.length > MAX_TOKEN || !SAFE.test(token)) return null;
    if (typeof cid !== 'string' || !CID.test(cid)) return null;
    const key = cid.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ token, cid });
  }
  return out;
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tira do HTML a imagem que não se conseguiu juntar (a tag <img> e outras referências). */
export const dropCidImage = (html: string, cid: string): string => {
  const ref = escapeRegex(`cid:${cid}`);
  return html
    .replace(new RegExp(`<img\\b[^>]*?["'(]${ref}["')][^>]*>`, 'gi'), '')
    .replace(new RegExp(ref, 'gi'), '');
};
