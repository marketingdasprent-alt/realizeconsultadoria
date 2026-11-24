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
import { bounceNotice, explainBounce, isBounce } from '../_shared/mail/bounce.ts';
import { pickFresh } from './pollFresh.ts';
import { IMAP_REAUTH_GAP_MS, isImapRecovery } from '../_shared/mail/imap-auth.ts';

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
  // "Novo" decide-se pela data de chegada à caixa, não pela do cabeçalho Date do remetente (ver
  // pollFresh.ts). Datas no futuro contam como "agora": senão o notified_until saltava para lá e
  // a caixa deixava de dar avisos de vez.
  const since = account.notified_until ? Date.parse(account.notified_until) : null;
  const { fresh, newest } = pickFresh(
    messages,
    since !== null && Number.isFinite(since) ? since : null,
    ruled?.moved,
    Date.now()
  );

  // Marca primeiro até onde se avisou (só se ninguém o mudou entretanto) e só depois avisa: se
  // a função for cortada a meio, ou correrem duas passagens, os mesmos emails não avisam 2 vezes.
  const until = new Date(newest || Date.now()).toISOString();
  if (until !== account.notified_until) {
    const claim = db.from('mail_accounts').update({ notified_until: until }).eq('id', account.id);
    const { data: claimed } = await (
      account.notified_until
        ? claim.eq('notified_until', account.notified_until)
        : claim.is('notified_until', null)
    ).select('id');
    if (!claimed?.length) return 0;
  }

  // Emails devolvidos: aviso à parte, com o motivo em português (lê-se o texto do aviso)
  const bounces = fresh.filter(mail => isBounce(mail.from?.email, mail.subject));
  const normal = fresh.filter(mail => !bounces.includes(mail));
  if (bounces.length) {
    const recipients = await recipientsOf(db, account);
    for (const mail of bounces.slice(0, 5)) {
      let text: string | null = null;
      try {
        const full = await driver.get(mail.id);
        text = full.text ?? full.html?.replace(/<[^>]+>/g, ' ') ?? null;
      } catch (err) {
        console.warn('mail-api poll: aviso de devolução ilegível', errorMessage(err));
      }
      const body = bounceNotice(explainBounce(text, account.email), mail.subject);
      for (const userId of recipients)
        await notify(db, userId, 'Email devolvido', `${body} · ${account.email}`);
    }
  }

  if (normal.length) {
    const recipients = await recipientsOf(db, account);
    const shared = !account.user_id;
    for (const userId of recipients) {
      if (normal.length > MAX_SINGLE) {
        await notify(
          db,
          userId,
          `${normal.length} emails novos`,
          `${account.email} · último de ${sender(normal[normal.length - 1])}`
        );
        continue;
      }
      for (const mail of normal) {
        const subject = mail.subject?.trim() || '(sem assunto)';
        await notify(db, userId, sender(mail), shared ? `${subject} · ${account.email}` : subject);
      }
    }
  }

  // Caixas IMAP: guarda já a cópia dos emails novos (abrem na hora), depois de avisar
  if (account.auth_method === 'imap') inBackground(precache(db, account.id, driver, fresh));

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
interface PollClaim {
  polledAt: string;
  updatedAt: string | null;
}

const claim = async (db: SupabaseClient, account: PollAccount): Promise<PollClaim | null> => {
  const gap = isImapRecovery(account)
    ? IMAP_REAUTH_GAP_MS
    : account.auth_method === 'imap'
      ? IMAP_GAP_MS
      : GAP_MS;
  const before = new Date(Date.now() - gap).toISOString();
  const polledAt = new Date().toISOString();
  const { data, error } = await db
    .from('mail_accounts')
    .update({ polled_at: polledAt })
    .eq('id', account.id)
    .eq('status', account.status)
    .or(`polled_at.is.null,polled_at.lt.${before}`)
    .select('id, updated_at');
  if (error) console.error('mail-api poll: reserva falhou', error.message);
  if (error || !data?.length) return null;
  return { polledAt, updatedAt: data[0].updated_at ?? null };
};

/** Só recupera depois de ler a Entrada, sem aplicar regras nem gerar avisos. */
const recoverImapAccount = async (
  db: SupabaseClient,
  account: PollAccount,
  driver: MailDriver,
  reservation: PollClaim,
  deadline: number
): Promise<number> => {
  if (!reservation.updatedAt) throw new Error('Reserva de recuperação sem versão.');
  if (Date.now() >= deadline) return 0;
  await driver.list({
    folder: 'inbox',
    query: null,
    pageToken: null,
    limit: 1,
    withoutSnippets: true,
  });
  // O limite externo não cancela o trabalho já iniciado: uma resposta tardia não reativa a conta.
  if (Date.now() >= deadline) return 0;
  const { data, error } = await db
    .from('mail_accounts')
    .update({ status: 'active', last_error: null })
    .eq('id', account.id)
    .eq('status', 'reauth')
    .eq('polled_at', reservation.polledAt)
    .eq('updated_at', reservation.updatedAt)
    .select('id');
  if (error) throw error;
  if (data?.length) console.info(`mail-api poll: conta IMAP recuperada ${account.id}`);
  return 0;
};

/** Contas ativas e recuperação lenta de IMAP em reauth; um erro não para as outras. */
export const pollNewMail = async (
  db: SupabaseClient,
  createDriver: (db: SupabaseClient, account: MailAccountRow) => Promise<MailDriver>
) => {
  const { data, error } = await db
    .from('mail_accounts')
    .select(`${ACCOUNT_COLUMNS}, notified_until, notify`)
    .or('status.eq.active,and(status.eq.reauth,auth_method.eq.imap)');
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
        // A verificação local também impede recuperar OAuth/contas desativadas por engano.
        if (account.status !== 'active' && !isImapRecovery(account)) return 0;
        const reservation = await claim(db, account);
        if (!reservation) return 0;
        const deadline = Date.now() + ACCOUNT_TIMEOUT_MS;
        // Uma caixa lenta (ex.: servidor IMAP pendurado) não atrasa as outras.
        return await withTimeout(
          (async () => {
            const driver = await createDriver(db, account);
            if (isImapRecovery(account))
              return recoverImapAccount(db, account, driver, reservation, deadline);
            return pollAccount(db, account, driver, rules.get(account.id) ?? []);
          })(),
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
