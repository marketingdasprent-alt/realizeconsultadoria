// Enche aos poucos a cópia local dos últimos 30 dias da Entrada das caixas IMAP (para abrirem
// sem ir ao alojamento). Corre sozinho de 2 em 2 minutos (pedido próprio, com limite de CPU): no
// máximo MAX_PER_RUN emails por vez, caixa a caixa, e lembra-se de onde ficou em cada caixa.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver } from '../_shared/mail/types.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';
import type { MailAccountRow } from '../_shared/mail-server/accounts.ts';
import { ACCOUNT_COLUMNS } from '../_shared/mail-server/accounts.ts';
import { cachedNames, writeCached } from './messageCache.ts';

const MAX_PER_RUN = 6;
const ACCOUNTS_PER_RUN = 2;
const PAGE = 25;
const DAYS = 30;

interface State {
  account_id: string;
  page_token: string | null;
  done: boolean;
}

const hexOf = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

export const backfillCache = async (
  db: SupabaseClient,
  createDriver: (db: SupabaseClient, account: MailAccountRow) => Promise<MailDriver>
) => {
  const { data: accounts, error } = await db
    .from('mail_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('status', 'active')
    .eq('auth_method', 'imap');
  if (error) throw error;
  const { data: states } = await db
    .from('mail_cache_state')
    .select('account_id, page_token, done, updated_at');
  const stateOf = new Map(
    ((states ?? []) as (State & { updated_at: string })[]).map(s => [s.account_id, s])
  );
  // As que ainda não acabaram, primeiro as que há mais tempo não avançam
  const queue = ((accounts ?? []) as MailAccountRow[])
    .filter(account => !stateOf.get(account.id)?.done)
    .sort(
      (a, b) =>
        Date.parse(stateOf.get(a.id)?.updated_at ?? '1970-01-01') -
        Date.parse(stateOf.get(b.id)?.updated_at ?? '1970-01-01')
    )
    .slice(0, ACCOUNTS_PER_RUN);

  const limit = Date.now() - DAYS * 86_400_000;
  let cached = 0;
  for (const account of queue) {
    if (cached >= MAX_PER_RUN) break;
    const state = stateOf.get(account.id);
    let pageToken = state?.page_token ?? null;
    let done = false;
    try {
      const driver = await createDriver(db, account);
      const page = await driver.list({
        folder: 'inbox',
        query: null,
        pageToken,
        limit: PAGE,
        withoutSnippets: true,
      });
      const have = await cachedNames(db, account.id);
      const recent = page.messages.filter(mail => (Date.parse(mail.date) || 0) >= limit);
      let pending = 0;
      for (const mail of recent) {
        if (have.has(await hexOf(mail.id))) continue;
        if (cached >= MAX_PER_RUN) {
          pending++;
          continue;
        }
        try {
          await writeCached(db, account.id, await driver.get(mail.id));
          cached++;
        } catch (err) {
          console.warn(`mail-api cópia 30 dias ${account.id}:`, errorMessage(err));
        }
      }
      // Página toda guardada: passa à seguinte; acaba quando chega a emails com mais de 30 dias
      if (!pending) {
        const older = recent.length < page.messages.length;
        done = older || !page.next_page_token;
        pageToken = done ? null : page.next_page_token;
      }
    } catch (err) {
      console.warn(`mail-api cópia 30 dias ${account.id}:`, errorMessage(err));
    }
    await db.from('mail_cache_state').upsert({
      account_id: account.id,
      page_token: pageToken,
      done,
      updated_at: new Date().toISOString(),
    });
  }
  return { accounts: queue.length, cached };
};
