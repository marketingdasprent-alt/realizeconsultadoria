// Avisos de email novo: a BD chama isto a cada minuto (pg_cron → pg_net, token de sistema).
// Para cada conta ativa lê os últimos emails da caixa de entrada e avisa quem a usa (o dono ou
// os membros de uma caixa partilhada) dos que chegaram por ler desde a última vez: aviso no
// Realize e notificação no telemóvel (trigger de user_notifications → push-send).
//
// A primeira passagem numa conta só marca o ponto de partida (não avisa dos antigos).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MailDriver, MailSummary } from '../_shared/mail/types.ts';
import { ACCOUNT_COLUMNS, type MailAccountRow } from '../_shared/mail-server/accounts.ts';
import { errorMessage, mapWithGroupLimit } from '../_shared/mail-server/http.ts';
import { activeRulesByAccount, applyRules, type MailRule } from './rules.ts';
import { inBackground, pruneCached, writeCached } from './messageCache.ts';

const PER_ACCOUNT = 10;
/** Intervalo mínimo entre leituras da mesma caixa (as IMAP limitam logins: 2 em 2 minutos). */
const GAP_MS = 25_000;
const IMAP_GAP_MS = 110_000;
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
  driver: MailDriver,
  rules: MailRule[]
): Promise<number> => {
  // As regras (mover para pastas) correm primeiro: o que sai da Entrada não gera aviso
  const ruled = rules.length ? await applyRules(db, driver, rules, false) : null;
  const { messages } = await driver.list({
    folder: 'inbox',
    query: null,
    pageToken: null,
    limit: PER_ACCOUNT,
    withoutSnippets: true,
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
          .filter(
            mail =>
              mail.unread && !ruled?.moved.has(mail.id) && (Date.parse(mail.date) || 0) > since
          )
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

  // Caixas IMAP: guarda já a cópia dos emails novos (abrem na hora), depois de avisar
  if (account.auth_method === 'imap') inBackground(precache(db, account.id, driver, fresh));

  const until = new Date(newest || Date.now()).toISOString();
  if (until !== account.notified_until) {
    await db.from('mail_accounts').update({ notified_until: until }).eq('id', account.id);
  }
  return fresh.length;
};

/** Emails novos guardados por caixa em cada passagem (os outros ficam para a primeira abertura). */
const PRECACHE_PER_ACCOUNT = 5;

const precache = async (
  db: SupabaseClient,
  accountId: string,
  driver: MailDriver,
  fresh: MailSummary[]
) => {
  for (const mail of fresh.slice(-PRECACHE_PER_ACCOUNT)) {
    try {
      await writeCached(db, accountId, await driver.get(mail.id));
    } catch (error) {
      console.warn(`mail-api cópia ${accountId}:`, errorMessage(error));
    }
  }
  // De vez em quando (1 em 30 passagens) apaga as cópias com mais de 30 dias
  if (Math.random() < 1 / 30) await pruneCached(db, accountId);
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
    .select(`${ACCOUNT_COLUMNS}, notified_until, notify`)
    .eq('status', 'active');
  if (error) throw error;
  const accounts = (data ?? []) as PollAccount[];
  // Uma falha a ler as regras não pára os avisos
  const rules = await activeRulesByAccount(db).catch(error => {
    console.error('mail-api poll: regras', errorMessage(error));
    return new Map<string, MailRule[]>();
  });
  // No máximo 2 caixas do mesmo servidor IMAP de cada vez (senão o alojamento recusa ligações)
  const results = await mapWithGroupLimit(
    accounts,
    account => account.imap_host ?? account.id,
    2,
    async account => {
      try {
        if (!(await claim(db, account))) return 0;
        // Uma caixa lenta (ex.: servidor IMAP pendurado) não atrasa as outras.
        return await withTimeout(
          (async () =>
            pollAccount(
              db,
              account,
              await createDriver(db, account),
              rules.get(account.id) ?? []
            ))(),
          ACCOUNT_TIMEOUT_MS
        );
      } catch (err) {
        console.error(`mail-api poll ${account.id}:`, errorMessage(err));
        return 0;
      }
    }
  );
  return { accounts: accounts.length, notified: results.reduce((sum, n) => sum + n, 0) };
};
