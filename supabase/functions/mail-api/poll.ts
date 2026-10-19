// Avisos de email novo: a BD chama isto a cada 30 segundos (pg_cron → pg_net, token de sistema).
// Para cada conta ativa lê os últimos emails da caixa de entrada e avisa quem a usa (o dono ou
// os membros de uma caixa partilhada) dos que chegaram por ler desde a última vez: aviso no
// Realize e notificação no telemóvel (trigger de user_notifications → push-send).
//
// A primeira passagem numa conta só marca o ponto de partida (não avisa dos antigos).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver, MailSummary } from '../_shared/mail/types.ts';
import { ACCOUNT_COLUMNS, type MailAccountRow } from '../_shared/mail-server/accounts.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

const PER_ACCOUNT = 10;
/** Intervalo mínimo entre leituras da mesma caixa (as IMAP limitam logins: 2 em 2 minutos). */
const GAP_MS = 25_000;
const IMAP_GAP_MS = 110_000;
/** Acima disto, um só aviso com o número de emails novos. */
const MAX_SINGLE = 3;
const LINK = '/colaborador/email';

type PollAccount = MailAccountRow & { notified_until: string | null };

const recipientsOf = async (db: SupabaseClient, account: PollAccount): Promise<string[]> => {
  if (account.user_id) return [account.user_id];
  const { data } = await db
    .from('mail_account_members')
    .select('user_id')
    .eq('account_id', account.id);
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
  });
  const newest = messages.reduce(
    (max, mail) => Math.max(max, Date.parse(mail.date) || 0),
    account.notified_until ? Date.parse(account.notified_until) : 0
  );
  const since = account.notified_until ? Date.parse(account.notified_until) : null;
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

  const until = new Date(newest || Date.now()).toISOString();
  if (until !== account.notified_until) {
    await db.from('mail_accounts').update({ notified_until: until }).eq('id', account.id);
  }
  return fresh.length;
};

/**
 * Reserva a caixa para esta passagem (atómico): duas passagens seguidas nunca leem a mesma caixa
 * ao mesmo tempo (o que avisaria duas vezes do mesmo email) e as IMAP só a cada 2 minutos.
 */
const claim = async (db: SupabaseClient, account: PollAccount): Promise<boolean> => {
  const gap = account.auth_method === 'imap' ? IMAP_GAP_MS : GAP_MS;
  const before = new Date(Date.now() - gap).toISOString();
  const { data, error } = await db
    .from('mail_accounts')
    .update({ polled_at: new Date().toISOString() })
    .eq('id', account.id)
    .or(`polled_at.is.null,polled_at.lt.${before}`)
    .select('id');
  if (error) console.error('mail-api poll: reserva falhou', error.message);
  return !error && (data ?? []).length > 0;
};

/** Passa por todas as contas ativas; os erros de uma conta não param as outras. */
export const pollNewMail = async (
  db: SupabaseClient,
  createDriver: (db: SupabaseClient, account: MailAccountRow) => Promise<MailDriver>
) => {
  const { data, error } = await db
    .from('mail_accounts')
    .select(`${ACCOUNT_COLUMNS}, notified_until`)
    .eq('status', 'active');
  if (error) throw error;
  const accounts = (data ?? []) as PollAccount[];
  const results = await Promise.all(
    accounts.map(async account => {
      try {
        if (!(await claim(db, account))) return 0;
        return await pollAccount(db, account, await createDriver(db, account));
      } catch (err) {
        console.error(`mail-api poll ${account.id}:`, errorMessage(err));
        return 0;
      }
    })
  );
  return { accounts: accounts.length, notified: results.reduce((sum, n) => sum + n, 0) };
};
