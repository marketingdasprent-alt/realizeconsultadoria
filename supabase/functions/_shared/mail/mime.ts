// MIME sem Buffer do Node: base64/base64url de texto UTF-8 e bytes, cabeçalhos RFC 2047
// (só codifica o que não é ASCII), parâmetros RFC 2231 e montagem da mensagem RFC 5322
// (texto + HTML em multipart/alternative, anexos em multipart/mixed, linhas ≤ 76).

import { formatAddress } from './address.ts';
import type { MailAddress } from './types.ts';

const CRLF = '\r\n';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i)] = i;
  table['-'.charCodeAt(0)] = 62;
  table['_'.charCodeAt(0)] = 63;
  return table;
})();

const encoder = new TextEncoder();

export const utf8Encode = (value: string): Uint8Array => encoder.encode(value);

export const utf8Decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** Bytes → texto, com o charset indicado (fallback UTF-8 se for desconhecido). */
export const decodeBytes = (bytes: Uint8Array, charset?: string | null): string => {
  const label = (charset ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
  // ASCII declarado é muitas vezes UTF-8 mal etiquetado; UTF-8 cobre os dois casos.
  const normalized = !label || label === 'us-ascii' || label === 'ascii' ? 'utf-8' : label;
  try {
    return new TextDecoder(normalized).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
};

/** Cada byte → um carácter (ISO-8859-1), para texto 7/8 bits como quoted-printable. */
export const bytesToLatin1 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return out;
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  const out = new Uint8Array(Math.ceil(bytes.length / 3) * 4);
  let o = 0;
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out[o++] = B64.charCodeAt((n >> 18) & 63);
    out[o++] = B64.charCodeAt((n >> 12) & 63);
    out[o++] = B64.charCodeAt((n >> 6) & 63);
    out[o++] = B64.charCodeAt(n & 63);
  }
  const rest = bytes.length - i;
  if (rest > 0) {
    const n = (bytes[i] << 16) | (rest === 2 ? bytes[i + 1] << 8 : 0);
    out[o++] = B64.charCodeAt((n >> 18) & 63);
    out[o++] = B64.charCodeAt((n >> 12) & 63);
    out[o++] = rest === 2 ? B64.charCodeAt((n >> 6) & 63) : 61;
    out[o++] = 61;
  }
  return new TextDecoder().decode(out);
};

/**
 * Base64 normal ou base64url → bytes. Ignora espaços/quebras de linha e o padding.
 * Com `lenient`, descarta caracteres inválidos e um resto truncado (leituras parciais).
 */
export const base64ToBytes = (input: string, options: { lenient?: boolean } = {}): Uint8Array => {
  let clean = input.replace(/[\s=]+/g, '');
  if (options.lenient) {
    clean = clean.replace(/[^A-Za-z0-9+/_-]/g, '');
    if (clean.length % 4 === 1) clean = clean.slice(0, -1);
  }
  if (clean.length % 4 === 1) throw new Error('base64 inválido');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const value = code < 256 ? B64_LOOKUP[code] : -1;
    if (value < 0) throw new Error('base64 inválido');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
};

/** Base64url sem padding (Gmail API "raw", PKCE, state). */
export const base64UrlEncode = (input: string | Uint8Array): string =>
  bytesToBase64(typeof input === 'string' ? utf8Encode(input) : input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const base64UrlDecode = (input: string): Uint8Array => base64ToBytes(input);

export const base64UrlDecodeToString = (input: string): string => utf8Decode(base64ToBytes(input));

/** Quebra base64 em linhas de 76 caracteres (RFC 2045). */
export const wrapBase64 = (base64: string, width = 76): string => {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += width) lines.push(base64.slice(i, i + width));
  return lines.join(CRLF);
};

/** Quoted-printable → bytes (quebras suaves "=\r\n" removidas). */
export const decodeQuotedPrintable = (input: string): Uint8Array => {
  const text = input.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 256) out.push(code);
    else out.push(...utf8Encode(ch));
  }
  return Uint8Array.from(out);
};

/** Desfaz o Content-Transfer-Encoding de uma parte (base64 / quoted-printable). */
export const decodeTransferEncoding = (bytes: Uint8Array, encoding?: string | null): Uint8Array => {
  const enc = (encoding ?? '').toLowerCase();
  if (enc === 'base64') return base64ToBytes(bytesToLatin1(bytes), { lenient: true });
  if (enc === 'quoted-printable') return decodeQuotedPrintable(bytesToLatin1(bytes));
  return bytes;
};

const needsEncoding = (value: string): boolean => /[^\x20-\x7e\t]/.test(value);

/** Remove CR/LF (evita injeção de cabeçalhos) e espaços repetidos. */
export const sanitizeHeaderText = (value: string): string =>
  value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** Encoded-words "=?UTF-8?B?...?=" (≤ 64 caracteres, cabem na 1.ª linha) sem partir UTF-8. */
const encodeWords = (value: string): string => {
  const words: string[] = [];
  let chunk: number[] = [];
  for (const ch of value) {
    const bytes = utf8Encode(ch);
    if (chunk.length + bytes.length > 39) {
      words.push(`=?UTF-8?B?${bytesToBase64(Uint8Array.from(chunk))}?=`);
      chunk = [];
    }
    chunk.push(...bytes);
  }
  if (chunk.length) words.push(`=?UTF-8?B?${bytesToBase64(Uint8Array.from(chunk))}?=`);
  return words.join(' ');
};

/** Valor de cabeçalho: ASCII fica como está; com acentos/emoji vai em RFC 2047. */
export const encodeHeaderValue = (value: string): string => {
  const clean = sanitizeHeaderText(value);
  return needsEncoding(clean) ? encodeWords(clean) : clean;
};

/** Endereço para cabeçalho: só o nome é codificado, nunca o email. */
export const formatAddressHeader = (address: MailAddress): string => {
  const name = address.name ? sanitizeHeaderText(address.name) : '';
  if (name && needsEncoding(name)) return `${encodeWords(name)} <${address.email}>`;
  return formatAddress({ name: name || null, email: address.email });
};

/** Descodifica encoded-words RFC 2047 (B e Q, qualquer charset suportado). */
export const decodeHeaderValue = (value: string): string => {
  const word = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
  return value
    .replace(/\r?\n[ \t]+/g, ' ')
    .replace(/(=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)\s+(?==\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)/g, '$1')
    .replace(word, (match, charset: string, enc: string, text: string) => {
      try {
        const bytes =
          enc.toUpperCase() === 'B'
            ? base64ToBytes(text)
            : decodeQuotedPrintable(text.replace(/_/g, ' '));
        return decodeBytes(bytes, charset.split('*')[0]);
      } catch {
        return match;
      }
    });
};

/** Divide "a; b=c" pelos ";" que não estão entre aspas. */
const splitParams = (value: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && inQuote && i + 1 < value.length) {
      current += ch + value[++i];
      continue;
    }
    if (ch === '"') inQuote = !inQuote;
    if (ch === ';' && !inQuote) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
};

const percentDecode = (value: string, charset: string): string => {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '%' && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...utf8Encode(value[i]));
    }
  }
  return decodeBytes(Uint8Array.from(bytes), charset);
};

/**
 * Content-Type / Content-Disposition → { value, params }. Suporta aspas, encoded-words
 * e RFC 2231 (filename*=UTF-8''..., incluindo continuações filename*0*=, filename*1*=).
 */
export const parseHeaderParams = (
  header: string | null | undefined
): { value: string; params: Record<string, string> } => {
  if (!header) return { value: '', params: {} };
  const [main, ...rest] = splitParams(header.replace(/\r?\n[ \t]+/g, ' '));
  const segments = new Map<string, { index: number; extended: boolean; text: string }[]>();
  const plain: Record<string, string> = {};

  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const rawKey = part.slice(0, eq).trim().toLowerCase();
    let text = part.slice(eq + 1).trim();
    if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
      text = text.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    const m = /^([^*]+)\*(?:(\d+)\*?)?$/.exec(rawKey);
    if (m) {
      const extended = rawKey.endsWith('*');
      const list = segments.get(m[1]) ?? [];
      list.push({ index: m[2] ? Number(m[2]) : 0, extended, text });
      segments.set(m[1], list);
    } else {
      plain[rawKey] = decodeHeaderValue(text);
    }
  }

  const params: Record<string, string> = { ...plain };
  for (const [key, list] of segments) {
    list.sort((a, b) => a.index - b.index);
    let charset = 'utf-8';
    const first = list[0];
    if (first.extended) {
      const quote = /^([^']*)'[^']*'([\s\S]*)$/.exec(first.text);
      if (quote) {
        charset = quote[1] || 'utf-8';
        first.text = quote[2];
      }
    }
    params[key] = list.map(s => (s.extended ? percentDecode(s.text, charset) : s.text)).join('');
  }

  return { value: main.trim().toLowerCase(), params };
};

/** Valor de um cabeçalho num bloco de cabeçalhos em texto (com linhas dobradas). */
export const extractHeader = (rawHeaders: string, name: string): string | null => {
  const unfolded = rawHeaders.replace(/\r?\n[ \t]+/g, ' ');
  const wanted = name.toLowerCase();
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0 && line.slice(0, colon).trim().toLowerCase() === wanted) {
      return line.slice(colon + 1).trim();
    }
  }
  return null;
};

/** Dobra um cabeçalho nos espaços para linhas ≤ 78 caracteres (RFC 5322). */
export const foldHeader = (line: string): string => {
  if (line.length <= 78) return line;
  const words = line.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + 1 + word.length > 76) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.join(`${CRLF} `);
};

export const randomHex = (bytes = 16): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b =>
    b.toString(16).padStart(2, '0')
  ).join('');

/** Message-ID no domínio do remetente: <hex.timestamp@dominio>. */
export const generateMessageId = (fromEmail: string): string => {
  const domain = fromEmail.split('@')[1]?.replace(/[^A-Za-z0-9.-]/g, '') || 'realize.local';
  return `<${randomHex(12)}.${Date.now().toString(36)}@${domain}>`;
};

/** Data RFC 5322 em UTC ("Thu, 15 Oct 2026 09:00:00 +0000"). */
export const formatMailDate = (date: Date): string => date.toUTCString().replace('GMT', '+0000');

const MIME_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;

const safeMime = (mime: string): string =>
  MIME_TYPE.test(mime.trim()) ? mime.trim().toLowerCase() : 'application/octet-stream';

const safeFilename = (name: string): string =>
  sanitizeHeaderText(name)
    .replace(/["\\/]/g, '_')
    .slice(0, 200) || 'anexo';

/** Parâmetro de nome de ficheiro: ASCII entre aspas, ou RFC 2231 + RFC 2047 para compatibilidade. */
const filenameParams = (param: 'name' | 'filename', filename: string): string => {
  if (!needsEncoding(filename)) return `${param}="${filename}"`;
  const encoded = Array.from(utf8Encode(filename), b =>
    /[A-Za-z0-9.\-_~]/.test(String.fromCharCode(b))
      ? String.fromCharCode(b)
      : `%${b.toString(16).toUpperCase().padStart(2, '0')}`
  ).join('');
  return param === 'filename'
    ? `filename*=UTF-8''${encoded}`
    : `name="${encodeWords(filename).replace(/ /g, '')}"`;
};

export interface RawAttachment {
  filename: string;
  mime: string;
  content: Uint8Array;
}

export interface RawMessageInput {
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  /** Só entra no cabeçalho com includeBcc (Gmail API remove-o antes de entregar; SMTP não). */
  bcc?: MailAddress[];
  includeBcc?: boolean;
  subject: string;
  text: string;
  html: string;
  attachments?: RawAttachment[];
  inReplyTo?: string | null;
  references?: string | null;
  messageId?: string | null;
  date?: Date;
}

const textPart = (mime: 'text/plain' | 'text/html', content: string): string =>
  [
    `Content-Type: ${mime}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(bytesToBase64(utf8Encode(content))),
  ].join(CRLF);

const multipart = (subtype: string, boundary: string, parts: string[]): string =>
  [
    `Content-Type: multipart/${subtype}; boundary="${boundary}"`,
    '',
    ...parts.map(p => `--${boundary}${CRLF}${p}`),
    `--${boundary}--`,
  ].join(CRLF);

/** Mensagem RFC 5322 completa (CRLF), pronta para Gmail API (base64url), SMTP ou IMAP APPEND. */
export const buildRawMessage = (input: RawMessageInput): string => {
  const headers: string[] = [];
  const add = (name: string, value: string | null | undefined) => {
    if (value) headers.push(foldHeader(`${name}: ${value}`));
  };
  const list = (addresses: MailAddress[] | undefined) =>
    addresses?.length ? addresses.map(formatAddressHeader).join(', ') : null;

  add('From', formatAddressHeader(input.from));
  add('To', list(input.to));
  add('Cc', list(input.cc));
  if (input.includeBcc) add('Bcc', list(input.bcc));
  add('Subject', encodeHeaderValue(input.subject));
  add('Date', formatMailDate(input.date ?? new Date()));
  add('Message-ID', input.messageId ? sanitizeHeaderText(input.messageId) : null);
  add('In-Reply-To', input.inReplyTo ? sanitizeHeaderText(input.inReplyTo) : null);
  add('References', input.references ? sanitizeHeaderText(input.references) : null);
  headers.push('MIME-Version: 1.0');

  const seed = randomHex(8);
  const html = input.html.trim() ? input.html : '';
  const text = input.text;
  const body = html
    ? multipart('alternative', `=_alt_${seed}`, [
        textPart('text/plain', text),
        textPart('text/html', html),
      ])
    : textPart('text/plain', text);

  const attachments = input.attachments ?? [];
  const content = attachments.length
    ? multipart('mixed', `=_mix_${seed}`, [
        body,
        ...attachments.map(a => {
          const filename = safeFilename(a.filename);
          return [
            `Content-Type: ${safeMime(a.mime)}; ${filenameParams('name', filename)}`,
            `Content-Disposition: attachment; ${filenameParams('filename', filename)}`,
            'Content-Transfer-Encoding: base64',
            '',
            wrapBase64(bytesToBase64(a.content)),
          ].join(CRLF);
        }),
      ])
    : body;

  return `${headers.join(CRLF)}${CRLF}${content}${CRLF}`;
};

/** Base64url (Gmail) → base64 normal com padding (o que o browser espera). */
export const base64UrlToBase64 = (input: string): string => {
  const b64 = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4);
};
