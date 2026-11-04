// Marcadores do Webmail (tabelas mail_labels e mail_message_labels): coloridos, vários por email,
// partilhados por quem tem acesso à caixa. Cada marcador pode ter uma automação ao ser posto
// (mover para uma pasta, marcar como lido, tirar outros marcadores). Ver _shared/mail/labels.ts.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  LABEL_COLORS,
  labelKeyOf,
  type LabelAutomation,
  type LabelColor,
} from '../_shared/mail/labels.ts';
import type {
  MailDriver,
  MailListParams,
  MailListResult,
  MailSummary,
} from '../_shared/mail/types.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

export interface MailLabel {
  id: string;
  account_id: string;
  name: string;
  color: LabelColor;
  on_apply: LabelAutomation;
}

const COLUMNS = 'id, account_id, name, color, on_apply';
export const MAX_LABELS_PER_ACCOUNT = 60;
const KEY_CHUNK = 150;

export interface LabelTarget {
  /** Id do email no fornecedor (para a automação: mover, marcar como lido). */
  id: string;
  /** Chave do email (Message-ID normalizado ou "id:…"). */
  key: string;
}

export const listLabels = async (db: SupabaseClient, accountId: string): Promise<MailLabel[]> => {
  const { data, error } = await db
    .from('mail_labels')
    .select(COLUMNS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MailLabel[];
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Automação limpa: só os campos conhecidos e só marcadores que existem nesta caixa. */
export const cleanAutomation = (raw: unknown, knownLabelIds: Set<string>): LabelAutomation => {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: LabelAutomation = {};
  const folderId = typeof input.folder_id === 'string' ? input.folder_id.trim() : '';
  const folderName = typeof input.folder_name === 'string' ? input.folder_name.trim() : '';
  if (folderId && folderName && !/[\r\n\0]/.test(folderId)) {
    out.folder_id = folderId.slice(0, 1000);
    out.folder_name = folderName.slice(0, 200);
  }
  if (input.mark_read === true) out.mark_read = true;
  const remove = Array.isArray(input.remove_label_ids)
    ? input.remove_label_ids.filter((id): id is string => isUuid(id) && knownLabelIds.has(id))
    : [];
  if (remove.length) out.remove_label_ids = [...new Set(remove)].slice(0, 20);
  return out;
};

export const isLabelColor = (value: unknown): value is LabelColor =>
  typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);

const ROWS_PER_PAGE = 1000;
const MAX_ROW_PAGES = 10;

/** Todas as linhas (marcador, email) de uma caixa; opcionalmente só as de um marcador. */
const labelRows = async (db: SupabaseClient, accountId: string, labelId: string | null) => {
  const rows: { message_key: string; label_id: string }[] = [];
  for (let page = 0; page < MAX_ROW_PAGES; page++) {
    let query = db
      .from('mail_message_labels')
      .select('message_key, label_id')
      .eq('account_id', accountId)
      .order('message_key', { ascending: true })
      .range(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE - 1);
    if (labelId) query = query.eq('label_id', labelId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as { message_key: string; label_id: string }[]));
    if ((data ?? []).length < ROWS_PER_PAGE) break;
  }
  return rows;
};

/** Quantos emails tem cada marcador da caixa (para os números ao lado dos marcadores). */
export const labelCounts = async (
  db: SupabaseClient,
  accountId: string
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const row of await labelRows(db, accountId, null))
    counts[row.label_id] = (counts[row.label_id] ?? 0) + 1;
  return counts;
};

/** Páginas da pasta vistas, no máximo, à procura de emails com o marcador (por pedido). */
const MAX_SCAN_PAGES = 6;

/**
 * Lista só os emails da pasta que têm o marcador: o servidor lê páginas da pasta e fica com os
 * que têm a chave guardada. Pára ao juntar uma página cheia, ao acabar a pasta ou ao fim de
 * MAX_SCAN_PAGES páginas (o "carregar mais" continua dali).
 */
export const listWithLabel = async (
  db: SupabaseClient,
  accountId: string,
  labelId: string,
  params: MailListParams,
  listPage: (params: MailListParams) => Promise<MailListResult>
): Promise<MailListResult> => {
  const keys = new Set((await labelRows(db, accountId, labelId)).map(row => row.message_key));
  if (!keys.size) return { messages: [], next_page_token: null };
  const messages: MailSummary[] = [];
  let next: string | null = params.pageToken ?? null;
  for (let i = 0; i < MAX_SCAN_PAGES; i++) {
    const result = await listPage({ ...params, pageToken: next });
    messages.push(...result.messages.filter(mail => keys.has(labelKeyOf(mail))));
    next = result.next_page_token;
    if (!next || messages.length >= (params.limit ?? 25)) break;
  }
  return { messages, next_page_token: next };
};

/** Das chaves dadas, as dos emails que já foram reencaminhados pelo Webmail. */
const forwardedKeys = async (
  db: SupabaseClient,
  accountId: string,
  keys: string[]
): Promise<Set<string>> => {
  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const { data, error } = await db
      .from('mail_forwarded')
      .select('message_key')
      .eq('account_id', accountId)
      .in('message_key', keys.slice(i, i + KEY_CHUNK));
    if (error) {
      console.error('mail-api reencaminhados:', errorMessage(error));
      break;
    }
    for (const row of data ?? []) found.add(row.message_key as string);
  }
  return found;
};

/** Regista que o email foi reencaminhado (a marca aparece na lista). */
export const markForwarded = async (
  db: SupabaseClient,
  accountId: string,
  messageKey: string,
  userId: string | null
): Promise<void> => {
  const { error } = await db
    .from('mail_forwarded')
    .upsert(
      { account_id: accountId, message_key: messageKey, forwarded_by: userId },
      { onConflict: 'account_id,message_key' }
    );
  if (error) console.error('mail-api reencaminhado:', errorMessage(error));
};

/** Acrescenta `label_ids` a cada email (uma só consulta por lista). */
export const attachLabels = async <T extends MailSummary>(
  db: SupabaseClient,
  accountId: string,
  messages: T[]
): Promise<T[]> => {
  if (!messages.length) return messages;
  const keys = [...new Set(messages.map(labelKeyOf))];
  const byKey = new Map<string, string[]>();
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const { data, error } = await db
      .from('mail_message_labels')
      .select('message_key, label_id')
      .eq('account_id', accountId)
      .in('message_key', keys.slice(i, i + KEY_CHUNK));
    if (error) {
      console.error('mail-api marcadores:', errorMessage(error));
      return messages;
    }
    for (const row of data ?? [])
      byKey.set(row.message_key as string, [
        ...(byKey.get(row.message_key as string) ?? []),
        row.label_id as string,
      ]);
  }
  const forwarded = await forwardedKeys(db, accountId, keys);
  return messages.map(mail => ({
    ...mail,
    label_ids: byKey.get(labelKeyOf(mail)) ?? [],
    forwarded: forwarded.has(labelKeyOf(mail)),
  }));
};

/**
 * Pôr (`on`) ou tirar um marcador a emails. Ao pôr, corre a automação do marcador: tira os outros
 * marcadores indicados, marca como lido e move para a pasta. Devolve os ids dos emails movidos
 * (saem da lista) e a mensagem do primeiro erro da automação, se houver.
 */
export const applyLabel = async (
  db: SupabaseClient,
  driver: MailDriver,
  accountId: string,
  label: MailLabel,
  targets: LabelTarget[],
  on: boolean,
  userId: string | null
): Promise<{ moved: Set<string>; error: string | null }> => {
  const moved = new Set<string>();
  if (!targets.length) return { moved, error: null };
  const keys = [...new Set(targets.map(t => t.key))];

  if (!on) {
    for (let i = 0; i < keys.length; i += KEY_CHUNK)
      await db
        .from('mail_message_labels')
        .delete()
        .eq('account_id', accountId)
        .eq('label_id', label.id)
        .in('message_key', keys.slice(i, i + KEY_CHUNK));
    return { moved, error: null };
  }

  const { error } = await db.from('mail_message_labels').upsert(
    keys.map(message_key => ({
      account_id: accountId,
      message_key,
      label_id: label.id,
      created_by: userId,
    })),
    { onConflict: 'account_id,message_key,label_id', ignoreDuplicates: true }
  );
  if (error) throw error;

  const auto = label.on_apply ?? {};
  if (auto.remove_label_ids?.length) {
    for (let i = 0; i < keys.length; i += KEY_CHUNK)
      await db
        .from('mail_message_labels')
        .delete()
        .eq('account_id', accountId)
        .in('label_id', auto.remove_label_ids)
        .in('message_key', keys.slice(i, i + KEY_CHUNK));
  }

  let firstError: string | null = null;
  for (const target of targets) {
    if (auto.mark_read) await driver.setRead(target.id, true).catch(() => undefined);
    if (auto.folder_id) {
      try {
        await driver.move(target.id, auto.folder_id);
        moved.add(target.id);
      } catch (err) {
        firstError ??= errorMessage(err);
      }
    }
  }
  return { moved, error: firstError };
};
