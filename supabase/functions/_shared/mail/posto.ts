// Postos de email (Admin → Realize Mail → Postos): regras sem dependências do Deno, para se
// poderem testar. O código do convite só existe no link; na base de dados guarda-se o hash.
import { isUuid } from './request.ts';

export const POSTO_NAME_MAX = 80;
export const POSTO_MAX_BOXES = 20;
/** O link do convite serve uma só vez e deixa de valer ao fim de 7 dias. */
export const POSTO_INVITE_DAYS = 7;
/** Tamanho do código (base64url de 32 bytes = 43 caracteres). */
const TOKEN_LENGTH = 43;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Nome do posto: sem espaços a mais, 1 a 80 caracteres. */
export const parsePostoName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= POSTO_NAME_MAX ? name : null;
};

/** Lista de acessos (caixas) do posto: ids válidos, sem repetidos, no máximo 20. */
export const parsePostoBoxes = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > POSTO_MAX_BOXES) return null;
  if (!value.every(isUuid)) return null;
  return [...new Set(value.map(id => id.toLowerCase()))];
};

const base64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Código novo e aleatório do convite (256 bits). */
export const newInviteToken = (): string => {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  if (token.length !== TOKEN_LENGTH) throw new Error('Código do convite inválido');
  return token;
};

/** O código tem o formato certo? (evita ir à base de dados com lixo) */
export const isInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

/** Hash (SHA-256 em hexadecimal) do código: é o que fica guardado. */
export const hashInviteToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

export const inviteExpiry = (now = Date.now()): string =>
  new Date(now + POSTO_INVITE_DAYS * 24 * 60 * 60_000).toISOString();

/** Ligação que o admin envia: abre a Realize Mail e entra no posto. */
export const inviteLink = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, '')}/?posto=${token}`;
