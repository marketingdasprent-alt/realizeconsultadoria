// Avisos de email novo: a BD chama isto a cada minuto (pg_cron → pg_net, token de sistema).
// Para cada conta ativa lê os últimos emails da caixa de entrada e avisa quem a usa (o dono ou
// os membros de uma caixa partilhada) dos que chegaram por ler desde a última vez: aviso no
// Realize e notificação no telemóvel (trigger de user_notifications → push-send).
//
// A primeira passagem numa conta só marca o ponto de partida (não avisa dos antigos).
//
// Escritas na BD (plano Nano): uma reserva por passagem (mail_poll_claim, uma só linha) e
// notified_until só nas contas onde chegou email. Uma passagem sem novidades não grava nada
// em mail_accounts.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver, MailSummary } from '../_shared/mail/types.ts';
import { ACCOUNT_COLUMNS, type MailAccountRow } from '../_shared/mail-server/accounts.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

const PER_ACCOUNT = 10;
/**
 * Reserva da passagem: enquanto dura, outra chamada não lê as caixas (o que avisaria duas
 * vezes do mesmo email). Mais longa do que uma passagem e mais curta do que o intervalo do
 * pg_cron (1 minuto ou mais).
 */
const LEASE_SECONDS = 50;
/** Intervalo mínimo entre leituras das caixas IMAP (os servidores limitam os logins). */
const IMAP_GAP_SECONDS = 110;
/** Tempo máximo por caixa em cada passagem. */
const ACCOUNT_TIMEOUT_MS = 20_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sem resposta em ${ms / 1000} s`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
/** Acima disto, um só aviso com o número de emails novos. */
const MAX_SINGLE = 3;
const LINK = '/colaborador/email';

type PollAccount = MailAccountRow & { notified_until: string | null; notify: boolean };

/** Quem recebe os avisos: o dono ou os membros, só se não os desligaram nesta caixa. */
const recipientsOf = async (db: SupabaseClient, account: PollAccount): Promise<string[]> => {
  if (account.user_id) return account.notify ? [account.user_id] : [];
  const { data } = await db
    .from('mail_account_members')
    .select('user_id')
    .eq('account_id', account.id)
    .eq('notify', true);
  return (data ?? []).map(row => row.user_id as string);
};

const sender = (mail: MailSummary) => mail.from?.name?.trim() || mail.from?.email || 'Email novo';

const notify = async (db: SupabaseClient, userId: string, title: string, body: string) => {
  const { error } = await db.rpc('rz_notify', {
    _user_id: userId,
    _kind: 'mail',
    _title: title,
    _body: body,
    _link: LINK,
    _actor_id: null,
  });
  if (error) console.error('mail-api poll: aviso falhou', error.message);
};

const pollAccount = async (
  db: SupabaseClient,
  account: PollAccount,
  driver: MailDriver
): Promise<number> => {
  const { messages } = await driver.list({
    folder: 'inbox',
    query: null,
    pageToken: null,
    limit: PER_ACCOUNT,
    withoutSnippets: true,
  });
  const since = account.notified_until ? Date.parse(account.notified_until) : null;
  const newest = messages.reduce(
    (max, mail) => Math.max(max, Date.parse(mail.date) || 0),
    since ?? 0
  );
  const fresh =
    since === null
      ? []
      : messages
          .filter(mail => mail.unread && (Date.parse(mail.date) || 0) > since)
          .sort((a, b) => a.date.localeCompare(b.date));

  if (fresh.length) {
    const recipients = await recipientsOf(db, account);
    const shared = !account.user_id;
    for (const userId of recipients) {
      if (fresh.length > MAX_SINGLE) {
        await notify(
          db,
          userId,
          `${fresh.length} emails novos`,
          `${account.email} · último de ${sender(fresh[fresh.length - 1])}`
        );
        continue;
      }
      for (const mail of fresh) {
        const subject = mail.subject?.trim() || '(sem assunto)';
        await notify(db, userId, sender(mail), shared ? `${subject} · ${account.email}` : subject);
      }
    }
  }

  // Compara o instante e não o texto: a BD devolve "…+00:00" e o toISOString "…Z", e por
  // isso a conta era regravada a cada passagem mesmo sem emails novos.
  if (since === null || newest > since) {
    const until = new Date(newest || Date.now()).toISOString();
    const { error } = await db
      .from('mail_accounts')
      .update({ notified_until: until })
      .eq('id', account.id);
    if (error) console.error(`mail-api poll ${account.id}: notified_until`, error.message);
  }
  return fresh.length;
};

/**
 * Reserva esta passagem (atómico, uma linha em mail_poll_lease): duas passagens seguidas
 * nunca leem as caixas ao mesmo tempo e as IMAP só entram a cada IMAP_GAP_SECONDS.
 */
const claimPass = async (db: SupabaseClient): Promise<{ claimed: boolean; imap: boolean }> => {
  const { data, error } = await db.rpc('mail_poll_claim', {
    p_lease_seconds: LEASE_SECONDS,
    p_imap_gap_seconds: IMAP_GAP_SECONDS,
  });
  if (error) throw error;
  const claim = (data ?? {}) as { claimed?: boolean; imap?: boolean };
  return { claimed: claim.claimed === true, imap: claim.imap === true };
};

/** Passa por todas as contas ativas; os erros de uma conta não param as outras. */
export const pollNewMail = async (
  db: SupabaseClient,
  createDriver: (db: SupabaseClient, account: MailAccountRow) => Promise<MailDriver>
) => {
  const { claimed, imap } = await claimPass(db);
  if (!claimed) return { accounts: 0, notified: 0 };
  let query = db
    .from('mail_accounts')
    .select(`${ACCOUNT_COLUMNS}, notified_until, notify`)
    .eq('status', 'active');
  if (!imap) query = query.neq('auth_method', 'imap');
  const { data, error } = await query;
  if (error) throw error;
  const accounts = (data ?? []) as PollAccount[];
  const results = await Promise.all(
    accounts.map(async account => {
      try {
        // Uma caixa lenta (ex.: servidor IMAP pendurado) não atrasa as outras.
        return await withTimeout(
          (async () => pollAccount(db, account, await createDriver(db, account)))(),
          ACCOUNT_TIMEOUT_MS
        );
      } catch (err) {
        console.error(`mail-api poll ${account.id}:`, errorMessage(err));
        return 0;
      }
    })
  );
  return { accounts: accounts.length, notified: results.reduce((sum, n) => sum + n, 0) };
};
