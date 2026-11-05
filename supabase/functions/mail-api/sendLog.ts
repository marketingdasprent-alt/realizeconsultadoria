// Registo de cada envio (correu bem ou não, porquê, quanto demorou) e o relatório diário do
// email para os super admins: caixas com erro, envios falhados nas últimas 24 h e o total.
// Assim os problemas veem-se de manhã, antes das queixas.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorMessage } from '../_shared/mail-server/http.ts';

export interface SendLogEntry {
  accountId: string;
  userId: string;
  ok: boolean;
  code?: string | null;
  message?: string | null;
  ms: number;
  attachments: number;
  recipients: number;
}

/** Guarda o envio no registo (melhor esforço: uma falha aqui nunca estraga o envio). */
export const logSend = async (db: SupabaseClient, entry: SendLogEntry) => {
  const { error } = await db.from('mail_send_log').insert({
    account_id: entry.accountId,
    user_id: entry.userId,
    ok: entry.ok,
    code: entry.code ?? null,
    message: entry.message?.slice(0, 300) ?? null,
    ms: Math.round(entry.ms),
    attachments: entry.attachments,
    recipients: entry.recipients,
  });
  if (error) console.warn('mail-api registo de envio:', errorMessage(error));
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Monta e envia (aviso na app) o relatório das últimas 24 h aos super admins. */
export const sendDailyReport = async (db: SupabaseClient, options: { dry?: boolean } = {}) => {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [logs, accounts, supers] = await Promise.all([
    db.from('mail_send_log').select('account_id, ok, message, ms').gte('created_at', since),
    db.from('mail_accounts').select('id, email, status, last_error'),
    db
      .from('admin_group_members')
      .select('user_id, admin_groups!inner(is_super_admin, is_active)')
      .eq('admin_groups.is_super_admin', true)
      .eq('admin_groups.is_active', true),
  ]);
  if (logs.error) throw logs.error;
  if (accounts.error) throw accounts.error;
  if (supers.error) throw supers.error;

  const emailOf = new Map(
    ((accounts.data ?? []) as { id: string; email: string }[]).map(a => [a.id, a.email])
  );
  const rows = (logs.data ?? []) as {
    account_id: string;
    ok: boolean;
    message: string | null;
    ms: number;
  }[];
  const failed = rows.filter(row => !row.ok);
  const slow = rows.filter(row => row.ok && row.ms > 20_000).length;
  const failedBy = new Map<string, { count: number; last: string | null }>();
  for (const row of failed) {
    const current = failedBy.get(row.account_id) ?? { count: 0, last: null };
    failedBy.set(row.account_id, { count: current.count + 1, last: row.message ?? current.last });
  }
  const broken = (
    (accounts.data ?? []) as { email: string; status: string; last_error: string | null }[]
  ).filter(a => a.status !== 'active' || a.last_error);

  const lines: string[] = [
    `${plural(rows.length, 'email enviado', 'emails enviados')}, ${plural(failed.length, 'falhou', 'falharam')}${slow ? `, ${plural(slow, 'demorou', 'demoraram')} mais de 20 s` : ''}.`,
  ];
  for (const [accountId, info] of [...failedBy].sort((a, b) => b[1].count - a[1].count).slice(0, 5))
    lines.push(
      `• ${emailOf.get(accountId) ?? accountId}: ${info.count}× — ${info.last ?? 'sem motivo'}`
    );
  if (broken.length)
    lines.push(
      `Caixas com problema: ${broken
        .slice(0, 5)
        .map(a => `${a.email}${a.last_error ? ` (${a.last_error.slice(0, 60)})` : ''}`)
        .join('; ')}`
    );
  else lines.push('Todas as caixas a sincronizar sem erros.');

  const title =
    failed.length || broken.length
      ? 'Email: há problemas a ver'
      : 'Email: tudo bem nas últimas 24 h';
  const body = lines.join('\n').slice(0, 900);

  // Super admins e, nas contas unificadas, também a conta de colaborador (onde trabalham)
  const adminIds = [...new Set(((supers.data ?? []) as { user_id: string }[]).map(s => s.user_id))];
  const { data: linked } = adminIds.length
    ? await db.from('employees').select('user_id').in('admin_user_id', adminIds)
    : { data: [] };
  const targets = [
    ...new Set([
      ...adminIds,
      ...((linked ?? []) as { user_id: string | null }[]).map(e => e.user_id).filter(Boolean),
    ]),
  ] as string[];
  // Ensaio: devolve o texto sem avisar ninguém
  if (options.dry) return { title, body, targets: targets.length };
  for (const userId of targets) {
    const { error } = await db.rpc('rz_notify', {
      _user_id: userId,
      _kind: 'mail',
      _title: title,
      _body: body,
      _link: '/colaborador/email',
      _actor_id: null,
    });
    if (error) console.warn('mail-api relatório: aviso falhou', error.message);
  }
  // O registo só serve para isto: guarda-se 60 dias
  await db
    .from('mail_send_log')
    .delete()
    .lt('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString());
  return {
    sent: rows.length,
    failed: failed.length,
    broken: broken.length,
    notified: targets.length,
  };
};
