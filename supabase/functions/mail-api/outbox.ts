// Caixa de saída (como o Outlook): Enviar guarda o pedido na fila e responde logo; o envio corre
// num pedido à parte (com o seu próprio limite de CPU — um email pesado já não derruba os envios
// dos outros) e repete-se sozinho, de minuto a minuto, se falhar ANTES de o email sair (ligação
// ao servidor). Um envio que fica a meio (função cortada) nunca se repete — pode ter saído — e
// a pessoa é avisada para confirmar nos Enviados.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MAIL_ERROR_MESSAGES } from '../_shared/mail/errors.ts';
import { errorMessage } from '../_shared/mail-server/http.ts';

const MAX_ATTEMPTS = 3;
/** "sending" há mais do que isto: a função foi cortada a meio. */
const STUCK_MS = 10 * 60_000;
const RETRY_AFTER_MS = 50_000;

/**
 * Falha antes de o email sair (não chegou a ligar ao servidor, ou demasiados pedidos): pode
 * repetir-se sem o enviar duas vezes. Ligação cortada a meio (ECONNRESET/ESOCKET) não se repete.
 */
export const isRetryable = (code: string, message: string) =>
  code === 'rate_limited' ||
  (/Não foi possível ligar/i.test(message) && !/ECONNRESET|ESOCKET/.test(message));

/** Pedidos maiores do que isto vão direto (a fila guarda o pedido inteiro na base de dados). */
export const MAX_QUEUE_BYTES = 6_000_000;

const notify = async (db: SupabaseClient, userId: string, title: string, body: string) => {
  const { error } = await db.rpc('rz_notify', {
    _user_id: userId,
    _kind: 'mail',
    _title: title,
    _body: body,
    _link: '/colaborador/email',
    _actor_id: null,
  });
  if (error) console.warn('mail-api caixa de saída: aviso falhou', error.message);
};

/** Pede (em fundo) o envio de um email da fila, num pedido próprio à função. */
export const triggerProcess = (id: string): Promise<unknown> => {
  const token = Deno.env.get('MAIL_SYSTEM_TOKEN');
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mail-api`;
  if (!token) return Promise.resolve();
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mail-system-token': token },
    body: JSON.stringify({ action: 'outbox-process', id }),
  }).then(res => res.body?.cancel());
};

/** Guarda o pedido de envio na fila; devolve o id. */
export const queueSend = async (
  db: SupabaseClient,
  userId: string,
  accountId: string,
  body: Record<string, unknown>
): Promise<string> => {
  const payload = { ...body, action: 'send' };
  const subject = typeof body.subject === 'string' ? body.subject.slice(0, 200) : '';
  const { data, error } = await db
    .from('mail_outbox')
    .insert({ user_id: userId, account_id: accountId, payload, subject, status: 'queued' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

/**
 * Envia um email da fila (só se ainda estiver "queued": dois pedidos ao mesmo tempo nunca o
 * enviam duas vezes). `send` é o envio normal da função (o mesmo do botão Enviar).
 */
export const processOutbox = async (
  db: SupabaseClient,
  id: string,
  send: (userId: string, payload: Record<string, unknown>) => Promise<Response>
) => {
  const { data: claimed, error } = await db
    .from('mail_outbox')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'queued')
    .select('id, user_id, payload, attempts, subject')
    .maybeSingle();
  if (error) throw error;
  if (!claimed) return { id, skipped: true };
  const row = claimed as {
    id: string;
    user_id: string;
    payload: Record<string, unknown>;
    attempts: number;
    subject: string;
  };
  const attempts = (row.attempts ?? 0) + 1;
  let ok = false;
  let code = 'server_error';
  let message = 'Erro inesperado.';
  try {
    const res = await send(row.user_id, row.payload);
    const result = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      message?: string;
    };
    ok = res.ok && result.ok === true;
    code = result.code ?? (res.ok ? 'error' : 'server_error');
    // Sem texto do servidor: a mensagem conhecida para esse código (em português)
    message =
      result.message || (MAIL_ERROR_MESSAGES as Record<string, string | undefined>)[code] || '';
  } catch (err) {
    message = errorMessage(err);
  }

  if (ok) {
    await db
      .from('mail_outbox')
      .update({
        status: 'sent',
        attempts,
        payload: null,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    return { id, status: 'sent' };
  }
  const retry = isRetryable(code, message) && attempts < MAX_ATTEMPTS;
  await db
    .from('mail_outbox')
    .update({
      status: retry ? 'queued' : 'failed',
      attempts,
      last_error: message || code,
      // Falhou de vez: o conteúdo já não faz falta (o email reabre no ecrã de quem o escreveu)
      ...(retry ? {} : { payload: null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (!retry)
    await notify(
      db,
      row.user_id,
      'Email não enviado',
      `${row.subject || '(sem assunto)'} — ${message || 'o servidor de email recusou o envio'}`
    );
  return { id, status: retry ? 'queued' : 'failed' };
};

/** De minuto a minuto: repete os que esperam e dá como perdidos os que ficaram a meio. */
export const retryOutbox = async (db: SupabaseClient) => {
  const now = Date.now();
  const { data: stuck } = await db
    .from('mail_outbox')
    .select('id, user_id, subject')
    .eq('status', 'sending')
    .lt('updated_at', new Date(now - STUCK_MS).toISOString());
  for (const row of (stuck ?? []) as { id: string; user_id: string; subject: string }[]) {
    await db
      .from('mail_outbox')
      .update({
        status: 'failed',
        payload: null,
        last_error: 'O envio ficou a meio. Veja nos Enviados se saiu antes de reenviar.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'sending');
    await notify(
      db,
      row.user_id,
      'Email por confirmar',
      `${row.subject || '(sem assunto)'} — o envio ficou a meio. Veja nos Enviados se saiu antes de reenviar.`
    );
  }
  const { data: waiting } = await db
    .from('mail_outbox')
    .select('id')
    .eq('status', 'queued')
    .lt('updated_at', new Date(now - RETRY_AFTER_MS).toISOString())
    .order('created_at')
    .limit(5);
  const ids = ((waiting ?? []) as { id: string }[]).map(row => row.id);
  await Promise.all(ids.map(id => triggerProcess(id).catch(() => undefined)));
  // Enviados há mais de 7 dias saem da tabela (o conteúdo já tinha saído ao enviar)
  await db
    .from('mail_outbox')
    .delete()
    .in('status', ['sent', 'failed'])
    .lt('updated_at', new Date(now - 7 * 86_400_000).toISOString());
  return { stuck: (stuck ?? []).length, retried: ids.length };
};

/** Estado dos emails na fila desta pessoa (o ecrã pergunta enquanto espera). */
export const outboxStatus = async (db: SupabaseClient, userId: string, ids: unknown) => {
  const list = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string').slice(0, 20)
    : [];
  if (!list.length) return [];
  const { data, error } = await db
    .from('mail_outbox')
    .select('id, status, last_error, attempts')
    .eq('user_id', userId)
    .in('id', list);
  if (error) throw error;
  return data ?? [];
};
