// Emails por ler na caixa de entrada de cada conta que a pessoa usa (as suas e as partilhadas
// com ela), para os números da barra lateral do Webmail.
//
// Um só pedido leve por caixa (Graph: unreadItemCount da pasta; Gmail: messagesUnread do
// rótulo INBOX; IMAP: STATUS UNSEEN), poucas caixas de cada vez (o Graph limita os pedidos
// em simultâneo por caixa) e com limite de tempo. Uma caixa com erro não impede as outras.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isMailError, mailError } from '../_shared/mail/errors.ts';
import type { MailDriver } from '../_shared/mail/types.ts';
import { loadUserAccounts, type MailAccountRow } from '../_shared/mail-server/accounts.ts';
import { errorMessage, mapWithConcurrency } from '../_shared/mail-server/http.ts';

const CONCURRENCY = 4;
const TIMEOUT_MS = 12_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(mailError('provider_error', 'Sem resposta do fornecedor de email.')),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export interface UnreadCounts {
  /** account_id → emails por ler na Entrada. */
  counts: Record<string, number>;
  /** account_id → código do erro (a caixa fica sem número). */
  errors: Record<string, string>;
}

export const unreadCounts = async (
  db: SupabaseClient,
  userId: string,
  createDriver: (db: SupabaseClient, account: MailAccountRow) => Promise<MailDriver>
): Promise<UnreadCounts> => {
  // As caixas a precisar de nova autorização falhavam sempre: ficam de fora.
  const accounts = (await loadUserAccounts(db, userId)).filter(a => a.status !== 'reauth');
  const result: UnreadCounts = { counts: {}, errors: {} };
  await mapWithConcurrency(accounts, CONCURRENCY, async account => {
    try {
      const driver = await createDriver(db, account);
      result.counts[account.id] = await withTimeout(driver.unreadCount(), TIMEOUT_MS);
    } catch (error) {
      result.errors[account.id] = isMailError(error) ? error.code : 'server_error';
      if (!isMailError(error)) console.error(`mail-api unread ${account.id}:`, errorMessage(error));
    }
  });
  return result;
};
