// Validação dos pedidos ao mail-api (sem I/O): ids, limites, destinatários, anexos e
// dados de ligação IMAP/SMTP.

import { isValidEmail, parseAddress, parseAddressList } from './address.ts';
import { base64ToBytes, utf8Encode } from './mime.ts';
import type { MailAddress, MailProviderKey, OutgoingAttachment } from './types.ts';

export const MAX_SEND_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 20;
export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 50;

/** Portas SMTP permitidas: a Supabase Edge bloqueia saídas para 25 e 587. */
export const ALLOWED_SMTP_PORTS = [465];

export const MAIL_PROVIDER_KEYS: readonly MailProviderKey[] = [
  'gmail',
  'outlook',
  'office365',
  'exchange',
  'icloud',
  'yahoo',
  'aol',
  'imap',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Texto aparado até `max` caracteres; null se vazio ou não for texto. */
export const optionalString = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export const parseListLimit = (value: unknown): number => {
  const n = Number(value);
  if (value === undefined || value === null || !Number.isFinite(n)) return DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(n)));
};

/** Lista de destinatários (strings "Nome <a@b>" ou "a@b, c@d"); null se algum for inválido. */
export const parseRecipients = (value: unknown): MailAddress[] | null => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: MailAddress[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const parsed = item.includes(',') ? parseAddressList(item) : [parseAddress(item)];
    for (const address of parsed) {
      if (!address || !isValidEmail(address.email)) return null;
      out.push(address);
    }
  }
  return out;
};

export interface SendRequest {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  html: string;
  text: string;
  inReplyTo: string | null;
  attachments: OutgoingAttachment[];
  /** Conteúdo descodificado dos anexos (mesma ordem), para SMTP/Gmail. */
  attachmentBytes: Uint8Array[];
}

export type SendValidation =
  | { ok: true; value: SendRequest }
  | { ok: false; code: 'bad_request' | 'invalid_recipient' | 'too_large' };

/** Valida o pedido de envio: destinatários, anexos em base64 e limite total de 10 MB. */
/** Com `draft`, aceita-se sem destinatários (um rascunho ainda a meio). */
export const parseSendRequest = (
  body: Record<string, unknown>,
  options: { draft?: boolean } = {}
): SendValidation => {
  const to = parseRecipients(body.to);
  const cc = parseRecipients(body.cc);
  const bcc = parseRecipients(body.bcc);
  if (!to || !cc || !bcc) return { ok: false, code: 'invalid_recipient' };
  if (!options.draft && to.length + cc.length + bcc.length === 0)
    return { ok: false, code: 'invalid_recipient' };
  if (to.length + cc.length + bcc.length > 100) return { ok: false, code: 'bad_request' };

  const html = typeof body.html === 'string' ? body.html : '';
  const text = typeof body.text === 'string' ? body.text : '';
  const subject = typeof body.subject === 'string' ? body.subject.slice(0, 500) : '';
  const inReplyTo = optionalString(body.in_reply_to, 2000);

  const rawAttachments = body.attachments ?? [];
  if (!Array.isArray(rawAttachments) || rawAttachments.length > MAX_ATTACHMENTS) {
    return { ok: false, code: Array.isArray(rawAttachments) ? 'too_large' : 'bad_request' };
  }

  let total = utf8Encode(html).length + utf8Encode(text).length;
  if (total > MAX_SEND_BYTES) return { ok: false, code: 'too_large' };

  const attachments: OutgoingAttachment[] = [];
  const attachmentBytes: Uint8Array[] = [];
  for (const item of rawAttachments) {
    if (!isRecord(item) || typeof item.base64 !== 'string')
      return { ok: false, code: 'bad_request' };
    // Estimativa antes de descodificar (evita trabalho com pedidos enormes).
    if (total + Math.floor((item.base64.length * 3) / 4) > MAX_SEND_BYTES + 3) {
      return { ok: false, code: 'too_large' };
    }
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(item.base64.replace(/^data:[^,]*,/, ''));
    } catch {
      return { ok: false, code: 'bad_request' };
    }
    total += bytes.length;
    if (total > MAX_SEND_BYTES) return { ok: false, code: 'too_large' };
    const filename = optionalString(item.filename, 200) ?? 'anexo';
    const mime = optionalString(item.mime, 200) ?? 'application/octet-stream';
    attachments.push({ filename, mime, base64: item.base64.replace(/^data:[^,]*,/, '') });
    attachmentBytes.push(bytes);
  }

  return {
    ok: true,
    value: { to, cc, bcc, subject, html, text, inReplyTo, attachments, attachmentBytes },
  };
};

const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Servidor de email público: nome DNS válido, sem localhost nem IPs privados/internos. */
export const isPublicMailHost = (host: string): boolean => {
  const h = host.trim().toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return false;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (ipv4.slice(1).some(o => Number(o) > 255)) return false;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return HOSTNAME.test(h);
};

const port = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
};

export interface ImapConnectRequest {
  provider: MailProviderKey;
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  displayName: string | null;
}

export type ImapConnectValidation =
  | { ok: true; value: ImapConnectRequest }
  | { ok: false; code: 'bad_request' | 'smtp_port_blocked' };

export const parseImapConnectRequest = (body: Record<string, unknown>): ImapConnectValidation => {
  const provider = MAIL_PROVIDER_KEYS.find(p => p === body.provider) ?? null;
  const email = optionalString(body.email, 254)?.toLowerCase() ?? null;
  const password = typeof body.password === 'string' && body.password ? body.password : null;
  const imapHost = optionalString(body.imap_host, 253)?.toLowerCase() ?? null;
  const smtpHost = optionalString(body.smtp_host, 253)?.toLowerCase() ?? null;
  const imapPort = port(body.imap_port);
  const smtpPort = port(body.smtp_port);
  if (
    !provider ||
    !email ||
    !isValidEmail(email) ||
    !password ||
    password.length > 1000 ||
    !imapHost ||
    !smtpHost ||
    !isPublicMailHost(imapHost) ||
    !isPublicMailHost(smtpHost) ||
    !imapPort ||
    !smtpPort
  ) {
    return { ok: false, code: 'bad_request' };
  }
  if (!ALLOWED_SMTP_PORTS.includes(smtpPort)) return { ok: false, code: 'smtp_port_blocked' };
  return {
    ok: true,
    value: {
      provider,
      email,
      password,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      displayName: optionalString(body.display_name, 120),
    },
  };
};
