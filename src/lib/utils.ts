import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * URL canónico de produção da aplicação.
 * Usado para construir links em emails (reset de password, etc.) de forma a
 * NUNCA apontarem para domínios de preview (ex.: Lovable), mesmo que a app
 * tenha sido aberta a partir de um.
 */
export const APP_BASE_URL = 'https://realize.dasprent.pt';

/**
 * Devolve a origem a usar para links externos (emails).
 * - Em desenvolvimento local (localhost / 127.0.0.1) usa a origem atual,
 *   para que o fluxo funcione no ambiente de dev.
 * - Em qualquer outro caso devolve sempre o domínio de produção,
 *   ignorando domínios de preview como o Lovable.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin;
    }
  }
  return APP_BASE_URL;
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function formatNIF(nif: string): string {
  if (!nif) return '';
  const cleaned = nif.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function unformatNumber(value: string): string {
  return value.replace(/\s/g, '');
}

/**
 * Formata um IBAN no padrão internacional: letras/dígitos em maiúsculas,
 * agrupados em blocos de 4 separados por espaço (ex: "PT50 0002 0123 1234 5678 9015 4").
 * Aceita qualquer entrada (com ou sem espaços) e ignora caracteres inválidos.
 */
export function formatIban(iban: string): string {
  if (!iban) return '';
  const cleaned = iban.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const truncated = cleaned.slice(0, 34);
  return truncated.replace(/(.{4})/g, '$1 ').trim();
}

export function sanitizeFileName(fileName: string): string {
  const normalized = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
}

// Normaliza uma string para pesquisa: remove acentos, lowercase, trim.
export function normalizeForSearch(value: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Verifica se `target` contem todos os tokens de `term`, em qualquer ordem,
// ignorando acentos e case. Permite "pereira joao" -> "Joao Pereira".
export function matchesSearch(target: string, term: string): boolean {
  if (!term) return true;
  const normTarget = normalizeForSearch(target);
  const tokens = normalizeForSearch(term).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every(t => normTarget.includes(t));
}
