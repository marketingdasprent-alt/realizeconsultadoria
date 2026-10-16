// Edge function push-send: envia uma notificação do Realize para o telemóvel/browser de quem a
// recebe (Web Push com VAPID). Chamada pela base de dados (trigger em user_notifications, via
// pg_net) com o cabeçalho x-system-token; nunca pelo browser.
//
// POST { notification_id } → { ok, sent, removed }
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), MAIL_SYSTEM_TOKEN.
// verify_jwt = false: a autenticação é o token do sistema.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import webpush from 'npm:web-push@3.6.7';
import { json, serviceClient } from '../_shared/mail-server/http.ts';

const APP_URL = 'https://app.realizeconsultadoria.pt';

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const token = Deno.env.get('MAIL_SYSTEM_TOKEN');
  if (!token || req.headers.get('x-system-token') !== token) return json({ ok: false }, 401);

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return json({ ok: false, code: 'not_configured' });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@realize.pt', publicKey, privateKey);

  const body = (await req.json().catch(() => null)) as { notification_id?: string } | null;
  if (!body?.notification_id) return json({ ok: false, code: 'bad_request' }, 400);

  const db = serviceClient();
  const { data: notification } = await db
    .from('user_notifications')
    .select('id, user_id, title, body, link, kind')
    .eq('id', body.notification_id)
    .maybeSingle();
  if (!notification) return json({ ok: false, code: 'not_found' });

  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id);

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body ?? '',
    url: `${APP_URL}${notification.link ?? '/colaborador'}`,
    tag: notification.kind,
  });

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
