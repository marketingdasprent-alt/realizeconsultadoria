// Pessoas → Comunicados: envia um comunicado por email (Brevo, de marketing@dasprent.pt) aos
// colaboradores escolhidos e, se pedido, publica-o na app (notifications → Feed → Comunicados,
// com notificação no telemóvel pelo trigger rz_push_on_notice).
//
// POST {
//   subject, message (texto), senderName,
//   employeeIds: string[],                 // quem foi escolhido (a função relê da BD)
//   audience: { mode: 'all'|'company'|'department'|'people', companyIds: string[], label },
//   publishInApp: boolean,
//   attachments: { name, path, type, size }[],   // bucket marketing-emails
//   test?: boolean                         // só para o próprio admin, sem histórico nem app
// } → { ok, sent, failed: string[], requested, notices }
//
// POST { action: 'remind', noticeIds: string[], employeeIds: string[] } → volta a mandar a
// notificação do comunicado a quem ainda não confirmou (só as pessoas indicadas) → { ok, sent }
//
// Só administradores com o módulo Comunicados (marketing → email, executar) ou super admins.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { adminCaller } from '../_shared/admin-caller.ts';
import { broadcastEmailHtml } from '../_shared/broadcast-email.ts';

const SENDER_EMAIL = 'marketing@dasprent.pt';
const BATCH_SIZE = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface BroadcastRequest {
  action?: string;
  noticeIds?: string[];
  subject?: string;
  message?: string;
  senderName?: string;
  employeeIds?: string[];
  audience?: { mode?: string; companyIds?: string[]; label?: string };
  publishInApp?: boolean;
  attachments?: Attachment[];
  test?: boolean;
}

/** Lembrar quem falta: a notificação outra vez, só para essas pessoas (push-send). */
const remind = async (db: SupabaseClient, body: BroadcastRequest) => {
  const token = Deno.env.get('MAIL_SYSTEM_TOKEN');
  const noticeIds = [...new Set(body.noticeIds ?? [])].slice(0, 500);
  const employeeIds = [...new Set(body.employeeIds ?? [])].slice(0, 2000);
  if (!token || !noticeIds.length || !employeeIds.length) {
    return json({ ok: false, error: 'Nada para lembrar.' }, 400);
  }
  const { data: people } = await db
    .from('employees')
    .select('user_id')
    .in('id', employeeIds)
    .eq('is_active', true)
    .not('user_id', 'is', null);
  const userIds = (people ?? []).map(person => person.user_id as string);
  let sent = 0;
  for (const noticeId of noticeIds) {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-system-token': token },
      body: JSON.stringify({ notice_id: noticeId, user_ids: userIds }),
    });
    const result = (await res.json().catch(() => null)) as { sent?: number } | null;
    sent += result?.sent ?? 0;
  }
  return json({ ok: true, sent, people: userIds.length });
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const caller = await adminCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  const { data: allowed } = await db.rpc('has_module_permission', {
    _user_id: caller.userId,
    _module_key: 'marketing',
    _permission: 'execute',
    _topic_key: 'email',
  });
  if (!allowed) return json({ ok: false, error: 'Sem permissão para enviar comunicados.' }, 403);

  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoKey) return json({ ok: false, error: 'Configuração de email em falta.' }, 500);

  const body = (await req.json().catch(() => null)) as BroadcastRequest | null;
  if (body?.action === 'remind') return remind(db, body);
  const subject = body?.subject?.trim().slice(0, 200) ?? '';
  const message = body?.message?.trim().slice(0, 20000) ?? '';
  const senderName = body?.senderName?.trim().slice(0, 120) ?? '';
  if (!subject || !message || !senderName) {
    return json({ ok: false, error: 'Falta o assunto, a mensagem ou quem assina.' }, 400);
  }
  const ids = [...new Set((body?.employeeIds ?? []).filter(id => typeof id === 'string'))];
  const test = body?.test === true;

  // Quem recebe: relido da BD (ativos), sem endereços repetidos.
  const { data: people, error: peopleError } = test
    ? { data: [], error: null }
    : await db
        .from('employees')
        .select('id, email, company_id')
        .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_active', true);
  if (peopleError) return json({ ok: false, error: 'Não foi possível ler os colaboradores.' }, 500);
  const emails = test
    ? [caller.email ?? ''].filter(email => EMAIL.test(email))
    : [
        ...new Set(
          (people ?? [])
            .map(person => (person.email ?? '').trim().toLowerCase())
            .filter(email => EMAIL.test(email))
        ),
      ];
  if (!emails.length && !(body?.publishInApp && (people ?? []).length)) {
    return json(
      { ok: false, error: test ? 'A sua conta não tem email.' : 'Ninguém para enviar.' },
      400
    );
  }

  // Anexos: ligações assinadas (1 h) que o Brevo vai buscar.
  const attachments: { url: string; name: string }[] = [];
  for (const file of body?.attachments ?? []) {
    const { data: signed } = await db.storage
      .from('marketing-emails')
      .createSignedUrl(file.path, 3600);
    if (signed?.signedUrl) attachments.push({ url: signed.signedUrl, name: file.name });
  }

  const html = broadcastEmailHtml({ subject, message, senderName });
  const failed: string[] = [];
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(email =>
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: senderName, email: SENDER_EMAIL },
            to: [{ email }],
            subject: test ? `[Teste] ${subject}` : subject,
            htmlContent: html,
            ...(attachments.length ? { attachment: attachments } : {}),
          }),
        })
      )
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok) sent += 1;
      else failed.push(batch[index]);
    });
  }
  if (test) return json({ ok: sent > 0, sent, failed, requested: emails.length, notices: 0 });

  // Na app: um aviso para todos, um por empresa ou um por pessoa.
  let notices = 0;
  if (body?.publishInApp && (people ?? []).length) {
    const mode = body.audience?.mode;
    const base = { title: subject, message, created_by: caller.userId, is_active: true };
    type NoticeRow = typeof base & { company_id: string | null; employee_id: string | null };
    const rows: NoticeRow[] =
      mode === 'all'
        ? [{ ...base, company_id: null, employee_id: null }]
        : mode === 'company'
          ? [...new Set(body.audience?.companyIds ?? [])].map(companyId => ({
              ...base,
              company_id: companyId,
              employee_id: null,
            }))
          : (people ?? []).map(person => ({ ...base, company_id: null, employee_id: person.id }));
    const { error: noticeError, count } = await db
      .from('notifications')
      .insert(rows, { count: 'exact' });
    if (noticeError) console.error('[broadcast-send] app', noticeError.message);
    else notices = count ?? rows.length;
  }

  const { error: historyError } = await db.from('marketing_emails').insert({
    subject,
    message,
    sender: senderName,
    cc_emails: null,
    recipients_count: sent,
    requested_count: emails.length,
    failed_emails: failed,
    audience_label: body?.audience?.label?.slice(0, 200) ?? null,
    published_in_app: notices > 0,
    attachments_metadata: body?.attachments?.length ? body.attachments : null,
    created_by: caller.userId,
  });
  if (historyError) console.error('[broadcast-send] histórico', historyError.message);

  return json({ ok: sent > 0 || notices > 0, sent, failed, requested: emails.length, notices });
});
