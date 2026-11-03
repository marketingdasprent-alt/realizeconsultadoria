// Regras do Webmail (tabela mail_rules): "se o remetente / a palavra-chave for X, move o email
// para a pasta Y". Aplicam-se a cada passagem de email novo (poll.ts) e, ao criar uma regra,
// aos emails que já estão na Entrada.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver, MailSummary } from '../_shared/mail/types.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

export interface MailRule {
  id: string;
  account_id: string;
  name: string;
  from_contains: string | null;
  keyword: string | null;
  folder_id: string;
  folder_name: string;
  mark_read: boolean;
  is_active: boolean;
  last_error: string | null;
  created_at: string;
}

const COLUMNS =
  'id, account_id, name, from_contains, keyword, folder_id, folder_name, mark_read, is_active, last_error, created_at';
/** Emails vistos por regra em cada passagem. */
const PER_RULE = 50;
/** Emails que chegaram até 10 minutos antes de a regra existir ainda contam (relógios, atrasos). */
const GRACE_MS = 10 * 60_000;
export const MAX_RULES_PER_ACCOUNT = 20;

export const listRules = async (db: SupabaseClient, accountId: string): Promise<MailRule[]> => {
  const { data, error } = await db
    .from('mail_rules')
    .select(COLUMNS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MailRule[];
};

/** Regras ativas de várias caixas de uma vez (a passagem de email novo). */
export const activeRulesByAccount = async (
  db: SupabaseClient
): Promise<Map<string, MailRule[]>> => {
  const { data, error } = await db.from('mail_rules').select(COLUMNS).eq('is_active', true);
  if (error) throw error;
  const map = new Map<string, MailRule[]>();
  for (const rule of (data ?? []) as MailRule[])
    map.set(rule.account_id, [...(map.get(rule.account_id) ?? []), rule]);
  return map;
};

const matchesFrom = (mail: MailSummary, needle: string | null) => {
  const wanted = needle?.trim().toLowerCase();
  if (!wanted) return true;
  const sender = `${mail.from?.name ?? ''} ${mail.from?.email ?? ''}`.toLowerCase();
  return sender.includes(wanted);
};

/**
 * Aplica as regras à Entrada. `backfill`: também aos emails que já lá estavam antes de a regra
 * existir; senão só aos que chegaram depois. Devolve os ids dos emails movidos (para o aviso de
 * "email novo" os deixar de fora) e quantos foram.
 */
export const applyRules = async (
  db: SupabaseClient,
  driver: MailDriver,
  rules: MailRule[],
  backfill: boolean
): Promise<{ moved: Set<string>; count: number }> => {
  const moved = new Set<string>();
  for (const rule of rules) {
    const query = (rule.keyword?.trim() || rule.from_contains?.trim() || '').slice(0, 200);
    if (!query) continue;
    try {
      const { messages } = await driver.list({
        folder: 'inbox',
        query,
        pageToken: null,
        limit: PER_RULE,
        withoutSnippets: true,
      });
      const since = Date.parse(rule.created_at) - GRACE_MS;
      const matches = messages.filter(
        mail =>
          !moved.has(mail.id) &&
          matchesFrom(mail, rule.from_contains) &&
          (backfill || (Date.parse(mail.date) || 0) >= since)
      );
      for (const mail of matches) {
        if (rule.mark_read && mail.unread) await driver.setRead(mail.id, true).catch(() => {});
        await driver.move(mail.id, rule.folder_id);
        moved.add(mail.id);
      }
      if (rule.last_error)
        await db.from('mail_rules').update({ last_error: null }).eq('id', rule.id);
    } catch (error) {
      // Ex.: a pasta foi apagada. Guarda-se o motivo (a regra mostra-o) e as outras seguem.
      const message = errorMessage(error).slice(0, 300);
      console.error(`mail-api regra ${rule.id}:`, message);
      await db.from('mail_rules').update({ last_error: message }).eq('id', rule.id);
    }
  }
  return { moved, count: moved.size };
};
