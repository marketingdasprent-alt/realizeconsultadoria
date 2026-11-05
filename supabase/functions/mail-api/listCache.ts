// Lista guardada das caixas IMAP (como o Outlook): a primeira página de cada pasta fica no cesto
// privado; o Realize mostra-a na hora e vai buscar a nova em fundo. Com a lista, os primeiros
// emails que ainda não têm cópia ficam guardados também (abrem sem esperar pelo alojamento).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver, MailListResult, MailSummary } from '../_shared/mail/types.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';
import { cachedNames, writeCached } from './messageCache.ts';

const BUCKET = 'mail-cache';
const MAX_BYTES = 2 * 1024 * 1024;
/** Lista com mais de um dia já não se mostra (lê-se do servidor). */
const MAX_AGE_MS = 86_400_000;

interface CachedList {
  savedAt: string;
  result: MailListResult;
}

const hexOf = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

const listName = async (accountId: string, folderKey: string) =>
  `lists/${accountId}/${(await hexOf(folderKey)).slice(0, 32)}.json`;

const upload = async (db: SupabaseClient, name: string, value: unknown) => {
  const body = JSON.stringify(value);
  if (body.length > MAX_BYTES) return;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(name, new Blob([body], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) throw error;
};

/** A última primeira página guardada desta pasta (ou null). */
export const readCachedList = async (
  db: SupabaseClient,
  accountId: string,
  folderKey: string
): Promise<MailListResult | null> => {
  const { data, error } = await db.storage
    .from(BUCKET)
    .download(await listName(accountId, folderKey));
  if (error || !data) return null;
  try {
    const cached = JSON.parse(await data.text()) as CachedList;
    if (Date.now() - Date.parse(cached.savedAt) > MAX_AGE_MS) return null;
    return cached.result;
  } catch {
    return null;
  }
};

export const writeCachedList = async (
  db: SupabaseClient,
  accountId: string,
  folderKey: string,
  result: MailListResult
) =>
  upload(db, await listName(accountId, folderKey), {
    savedAt: new Date().toISOString(),
    result,
  } satisfies CachedList);

/**
 * Corrige as listas guardadas da caixa depois de uma ação no Realize (lido, estrela, mover,
 * lixo), para a lista na hora não mostrar o estado antigo. `patch` null = o email sai da lista.
 */
export const patchCachedLists = async (
  db: SupabaseClient,
  accountId: string,
  messageId: string,
  patch: Partial<MailSummary> | null
) => {
  const { data, error } = await db.storage.from(BUCKET).list(`lists/${accountId}`, { limit: 100 });
  if (error) throw error;
  for (const file of (data ?? []) as { name: string }[]) {
    const name = `lists/${accountId}/${file.name}`;
    const { data: blob } = await db.storage.from(BUCKET).download(name);
    if (!blob) continue;
    let cached: CachedList;
    try {
      cached = JSON.parse(await blob.text()) as CachedList;
    } catch {
      continue;
    }
    const messages = cached.result.messages;
    if (!messages.some(mail => mail.id === messageId)) continue;
    cached.result.messages = patch
      ? messages.map(mail => (mail.id === messageId ? { ...mail, ...patch } : mail))
      : messages.filter(mail => mail.id !== messageId);
    await upload(db, name, cached);
  }
};

/** Última vez que se pré-carregou cada caixa (nesta instância): no máximo a cada 2 minutos. */
const PRELOADED = new Map<string, number>();
const PRELOAD_COUNT = 8;

/** Guarda a cópia dos primeiros emails da lista que ainda não a têm (para abrirem na hora). */
export const preloadBodies = async (
  db: SupabaseClient,
  accountId: string,
  driver: MailDriver,
  messages: MailSummary[]
) => {
  if (Date.now() - (PRELOADED.get(accountId) ?? 0) < 120_000) return;
  PRELOADED.set(accountId, Date.now());
  const have = await cachedNames(db, accountId);
  let done = 0;
  for (const mail of messages) {
    if (done >= PRELOAD_COUNT) break;
    if (have.has(await hexOf(mail.id))) continue;
    done++;
    try {
      await writeCached(db, accountId, await driver.get(mail.id));
    } catch (error) {
      console.warn(`mail-api cópia ${accountId}:`, errorMessage(error));
    }
  }
};
