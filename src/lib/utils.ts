import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
