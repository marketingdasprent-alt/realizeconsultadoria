// Edge function push-send: envia uma notificação do Realize para o telemóvel/browser de quem a
// recebe (Web Push com VAPID). Chamada pela base de dados (triggers em user_notifications,
// chat_messages e notifications, via pg_net) com o cabeçalho x-system-token; nunca pelo browser.
//
// POST { notification_id }  → aviso para uma pessoa
// POST { chat_message_id }  → mensagem nova para os membros da conversa (menos quem a enviou e
//                             quem silenciou a conversa)
// POST { notice_id, user_ids? } → aviso/comunicado da app (notifications) para quem o vê
//                             (com user_ids, só para essas pessoas: lembrar quem não leu)
// → { ok, sent, removed }
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), MAIL_SYSTEM_TOKEN.
// verify_jwt = false: a autenticação é o token do sistema.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import webpush from 'npm:web-push@3.6.7';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, serviceClient } from '../_shared/mail-server/http.ts';

const APP_URL = 'https://app.realizeconsultadoria.pt';

interface Push {
  userIds: string[];
  payload: {
    title: string;
    body: string;
    url: string;
    tag: string;
    conversationId?: string;
  };
}

const short = (text: string, max = 120) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const notificationPush = async (db: SupabaseClient, id: string): Promise<Push | null> => {
  const { data: notification } = await db
    .from('user_notifications')
    .select('id, user_id, title, body, link, kind')
    .eq('id', id)
    .maybeSingle();
  if (!notification) return null;
  return {
    userIds: [notification.user_id],
    payload: {
      title: notification.title,
      body: notification.body ?? '',
      url: `${APP_URL}${notification.link ?? '/colaborador'}`,
      tag: notification.kind,
    },
  };
};

/** Aviso da app (Feed → Comunicados): para todos, uma empresa ou uma pessoa. */
const noticePush = async (
  db: SupabaseClient,
  id: string,
  onlyUserIds?: string[]
): Promise<Push | null> => {
  const { data: notice } = await db
    .from('notifications')
    .select('id, title, message, company_id, employee_id, is_active')
    .eq('id', id)
    .maybeSingle();
  if (!notice?.is_active) return null;
  let people = db
    .from('employees')
    .select('user_id')
    .eq('is_active', true)
    .not('user_id', 'is', null);
  if (notice.employee_id) people = people.eq('id', notice.employee_id);
  else if (notice.company_id) people = people.eq('company_id', notice.company_id);
  const { data: rows } = await people;
  const wanted = onlyUserIds ? new Set(onlyUserIds) : null;
  const userIds = [...new Set((rows ?? []).map(row => row.user_id as string))].filter(
    userId => !wanted || wanted.has(userId)
  );
  if (!userIds.length) return null;
  return {
    userIds,
    payload: {
      title: notice.title,
      body: short(notice.message ?? ''),
      url: `${APP_URL}/colaborador/feed?filtro=comunicados`,
      tag: `notice-${notice.id}`,
    },
  };
};

const messagePreview = (message: {
  kind: string;
  body: string | null;
  attachment_name: string | null;
}) => {
  if (message.kind === 'image') return message.body ? `📷 ${message.body}` : '📷 Imagem';
  if (message.kind === 'audio') return '🎤 Mensagem de voz';
  if (message.kind === 'file') return `📎 ${message.attachment_name ?? 'Ficheiro'}`;
  return message.body ?? '';
};

const chatPush = async (db: SupabaseClient, id: string): Promise<Push | null> => {
  const { data: message } = await db
    .from('chat_messages')
    .select('id, conversation_id, sender_id, kind, body, attachment_name, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!message || message.deleted_at) return null;

  const [{ data: conversation }, { data: members }, { data: muted }, { data: sender }] =
    await Promise.all([
      db
        .from('chat_conversations')
        .select('id, kind, title')
        .eq('id', message.conversation_id)
        .maybeSingle(),
      db.from('chat_members').select('user_id').eq('conversation_id', message.conversation_id),
      db
        .from('chat_member_settings')
        .select('user_id')
        .eq('conversation_id', message.conversation_id)
        .eq('is_muted', true),
      message.sender_id
        ? db
            .from('employees')
            .select('name')
            .eq('user_id', message.sender_id)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if (!conversation) return null;

  const silenced = new Set((muted ?? []).map(row => row.user_id));
  const userIds = (members ?? [])
    .map(row => row.user_id as string)
    .filter(userId => userId !== message.sender_id && !silenced.has(userId));
  if (!userIds.length) return null;

  const senderName = (sender as { name?: string } | null)?.name ?? 'Colega';
  const preview = short(messagePreview(message));
  const isDirect = conversation.kind === 'direct';
  return {
    userIds,
    payload: {
      title: isDirect ? senderName : (conversation.title ?? 'Mensagens'),
      body: isDirect ? preview : `${firstName(senderName)}: ${preview}`,
      url: `${APP_URL}/colaborador?c=${conversation.id}`,
      // Uma notificação por conversa: a mais recente substitui a anterior.
      tag: `chat-${conversation.id}`,
      conversationId: conversation.id,
    },
  };
};

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const token = Deno.env.get('MAIL_SYSTEM_TOKEN');
  if (!token || req.headers.get('x-system-token') !== token) return json({ ok: false }, 401);

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return json({ ok: false, code: 'not_configured' });
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@realize.pt',
    publicKey,
    privateKey
  );

  const body = (await req.json().catch(() => null)) as {
    notification_id?: string;
    chat_message_id?: string;
    notice_id?: string;
    user_ids?: string[];
  } | null;
  if (!body?.notification_id && !body?.chat_message_id && !body?.notice_id) {
    return json({ ok: false, code: 'bad_request' }, 400);
  }

  const db = serviceClient();
  const push = body.chat_message_id
    ? await chatPush(db, body.chat_message_id)
    : body.notice_id
      ? await noticePush(
          db,
          body.notice_id,
          Array.isArray(body.user_ids) ? body.user_ids : undefined
        )
      : await notificationPush(db, body.notification_id as string);
  if (!push) return json({ ok: true, sent: 0, removed: 0 });

  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', push.userIds);

  const payload = JSON.stringify(push.payload);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subscriptions ?? []).map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 6, urgency: 'high' }
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // O telemóvel já não aceita (app desinstalada, permissão retirada): esquece a subscrição.
        if (status === 404 || status === 410) gone.push(sub.id);
        else console.error('push-send: falhou', status ?? (error as Error).message);
      }
    })
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return json({ ok: true, sent, removed: gone.length });
});
