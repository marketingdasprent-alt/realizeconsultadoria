// Endereços de email: "Nome <a@b>", nomes entre aspas, listas separadas por vírgulas
// (fora de aspas, <> e comentários) e grupos RFC 5322 ("Equipa: a@b, c@d;").

import type { MailAddress } from './types.ts';

const SPECIALS = /[()<>[\]:;@\\,."]/;
const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;

/** Endereço utilizável para envio (validação prática, não RFC completa). */
export const isValidEmail = (email: string): boolean => email.length <= 254 && EMAIL.test(email);

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return trimmed;
};

const cleanName = (raw: string, email: string): string | null => {
  const name = unquote(raw).replace(/\s+/g, ' ').trim();
  if (!name || name.toLowerCase() === email.toLowerCase()) return null;
  return name;
};

/** Um endereço ("Nome" <a@b>, Nome <a@b>, a@b (Nome) ou a@b). Null se vazio. */
export const parseAddress = (raw: string): MailAddress | null => {
  const value = raw.trim();
  if (!value) return null;

  const angle = /^([\s\S]*?)<([^<>]*)>\s*(?:\([^()]*\))?\s*$/.exec(value);
  if (angle) {
    const email = angle[2].trim();
    if (!email) return null;
    return { name: cleanName(angle[1], email), email };
  }

  const comment = /^([^\s()]+)\s*\(([^()]*)\)\s*$/.exec(value);
  if (comment) {
    const email = comment[1].trim();
    return { name: cleanName(comment[2], email), email };
  }

  const email = unquote(value);
  return email ? { name: null, email } : null;
};

/** Divide uma lista de endereços pelas vírgulas/ponto e vírgula que não estão citados. */
const splitList = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let angle = 0;
  let paren = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      current += ch;
      if (ch === '\\' && i + 1 < input.length) current += input[++i];
      else if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '"') inQuote = true;
    else if (ch === '<') angle++;
    else if (ch === '>') angle = Math.max(0, angle - 1);
    else if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (angle === 0 && paren === 0) {
      if (ch === ',' || ch === ';') {
        tokens.push(current);
        current = '';
        continue;
      }
      // Início de grupo ("Equipa:"): o nome do grupo não é um endereço.
      if (ch === ':' && !current.includes('@')) {
        current = '';
        continue;
      }
    }
    current += ch;
  }
  tokens.push(current);
  return tokens;
};

/** Lista de endereços de um cabeçalho (To, Cc, ...). Ignora entradas vazias. */
export const parseAddressList = (input: string | null | undefined): MailAddress[] => {
  if (!input) return [];
  return splitList(input)
    .map(parseAddress)
    .filter((a): a is MailAddress => a !== null);
};

/** Formata para mostrar/compor ("Nome" <a@b> só com aspas quando necessário). */
export const formatAddress = (address: MailAddress): string => {
  const name = address.name?.replace(/[\r\n]+/g, ' ').trim();
  if (!name) return address.email;
  const display = SPECIALS.test(name) ? `"${name.replace(/(["\\])/g, '\\$1')}"` : name;
  return `${display} <${address.email}>`;
};

export const formatAddressList = (addresses: MailAddress[]): string =>
  addresses.map(formatAddress).join(', ');
