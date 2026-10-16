// Notificações push no telemóvel/computador (Web Push). A chave pública VAPID é pública por
// natureza; a privada está só nos segredos da Supabase (edge function push-send).
import { supabase } from '@/integrations/supabase/client';

export const VAPID_PUBLIC_KEY =
  'BKVjBM6JJUGNOgW3WCbpVZl00OlUoV2kTgGCu7cv4OvjyB9f9PlJhDPk29bu4OPIX4oHhVRTykfR6mDF7qR8RSQ';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const toKey = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const registration = async () =>
  'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration() : undefined;

/** Estado atual neste dispositivo. */
export const pushState = async (): Promise<PushState> => {
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('PushManager' in window) || !('Notification' in window) || !('serviceWorker' in navigator))
    return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
};

/** Pede autorização, subscreve e guarda a subscrição deste dispositivo. */
export const enablePush = async (userId: string): Promise<PushState> => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  // A app instalada/publicada regista o service worker ao abrir; no localhost não há.
  const reg = await registration();
  if (!reg) throw new Error('Sem service worker (abra a app publicada).');
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(VAPID_PUBLIC_KEY),
    }));
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return 'on';
};

/** Deixa de receber neste dispositivo. */
export const disablePush = async (): Promise<PushState> => {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
};
