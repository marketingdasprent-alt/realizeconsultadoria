// Cópia local dos emails das caixas IMAP (como o Outlook): o corpo do email (texto, HTML e
// imagens da assinatura, sem anexos) fica num cesto privado do armazenamento; abrir um email com
// cópia não vai ao servidor do alojamento (lento). A verificação de email novo guarda já os
// novos; os outros ficam guardados da primeira vez que se abrem. Cópias com mais de 30 dias saem.
//
// Só IMAP: no IMAP o id de um email (pasta + UID) nunca muda de conteúdo — um rascunho gravado
// outra vez ganha um UID novo. No Graph um rascunho editado mantém o id, por isso fica de fora.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailMessage } from '../_shared/mail/types.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

const BUCKET = 'mail-cache';
/** Emails maiores que isto (normalmente por imagens embebidas) não se guardam. */
const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_DAYS = 30;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Corre depois de responder (sem atrasar quem abriu o email). */
export const inBackground = (task: Promise<unknown>) => {
  const safe = task.catch(error => console.warn('mail-api cópia:', errorMessage(error)));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(safe);
};

const objectName = async (accountId: string, messageId: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageId));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${accountId}/${hex}.json`;
};

/** A cópia do email, ou null se não houver (ou estiver estragada). */
export const readCached = async (
  db: SupabaseClient,
  accountId: string,
  messageId: string
): Promise<MailMessage | null> => {
  const { data, error } = await db.storage
    .from(BUCKET)
    .download(await objectName(accountId, messageId));
  if (error || !data) return null;
  try {
    const message = JSON.parse(await data.text()) as MailMessage;
    return message && message.id === messageId ? message : null;
  } catch {
    return null;
  }
};

/** Guarda a cópia (substitui a anterior). */
export const writeCached = async (
  db: SupabaseClient,
  accountId: string,
  message: MailMessage
): Promise<void> => {
  const body = JSON.stringify(message);
  if (body.length > MAX_BYTES) return;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(
      await objectName(accountId, message.id),
      new Blob([body], { type: 'application/json' }),
      {
        contentType: 'application/json',
        upsert: true,
      }
    );
  if (error) throw error;
};

/** Nomes (sem ".json") das cópias já guardadas desta caixa (até 1000, as mais recentes). */
export const cachedNames = async (db: SupabaseClient, accountId: string): Promise<Set<string>> => {
  const { data } = await db.storage
    .from(BUCKET)
    .list(accountId, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  return new Set(
    ((data ?? []) as { name: string }[]).map(file => file.name.replace(/\.json$/, ''))
  );
};

/** Apaga as cópias com mais de 30 dias de uma caixa (até 100 de cada vez). */
export const pruneCached = async (db: SupabaseClient, accountId: string): Promise<number> => {
  const { data, error } = await db.storage
    .from(BUCKET)
    .list(accountId, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error) throw error;
  const limit = Date.now() - KEEP_DAYS * 86_400_000;
  const files = (data ?? []) as { name: string; created_at?: string | null }[];
  const old = files
    .filter(file => file.created_at && Date.parse(file.created_at) < limit)
    .map(file => `${accountId}/${file.name}`);
  if (!old.length) return 0;
  const { error: removeError } = await db.storage.from(BUCKET).remove(old);
  if (removeError) throw removeError;
  return old.length;
};

/**
 * Apaga todas as cópias de uma caixa. Depois de apagar ou mudar o nome de uma pasta, os UIDs de
 * uma pasta recriada com o mesmo nome recomeçam em 1 e a cópia antiga (pasta:UID) mostraria
 * outro email. As cópias voltam a encher-se sozinhas (verificação de email e cópia de 30 dias).
 */
export const clearCachedMessages = async (db: SupabaseClient, accountId: string) => {
  for (let round = 0; round < 20; round += 1) {
    const { data, error } = await db.storage.from(BUCKET).list(accountId, { limit: 1000 });
    if (error) throw error;
    const names = ((data ?? []) as { name: string }[]).map(file => `${accountId}/${file.name}`);
    if (!names.length) return;
    const { error: removeError } = await db.storage.from(BUCKET).remove(names);
    if (removeError) throw removeError;
    if (names.length < 1000) return;
  }
};
