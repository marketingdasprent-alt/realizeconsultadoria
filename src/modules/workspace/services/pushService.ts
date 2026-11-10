// Notificações push no telemóvel/computador (Web Push). A chave pública VAPID é pública por
// natureza; a privada está só nos segredos da Supabase (edge function push-send).
import type { SupabaseClient } from '@supabase/supabase-js';
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
  // Subscrição da app antiga (outra chave) não recebe nada: conta como desligada
  return sub && sameKey(sub) ? 'on' : 'off';
};

/** A subscrição foi feita com esta chave? (as da app antiga "Realize Admin" tinham outra) */
const sameKey = (sub: PushSubscription) => {
  const used = sub.options?.applicationServerKey;
  if (!used) return true;
  const ours = toKey(VAPID_PUBLIC_KEY);
  const theirs = new Uint8Array(used);
  return theirs.length === ours.length && theirs.every((byte, i) => byte === ours[i]);
};

/**
 * A subscrição deste browser com a nossa chave: a de outra chave (app antiga) é trocada — senão
 * o browser recusava criar a nova ("já existe uma subscrição com outra chave") e nada se gravava.
 */
const currentSubscription = async (reg: ServiceWorkerRegistration) => {
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing)) return existing;
  if (existing) await existing.unsubscribe().catch(() => false);
  const options = { userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) };
  try {
    return await reg.pushManager.subscribe(options);
  } catch {
    // Às vezes fica uma subscrição presa: limpa e tenta uma vez mais
    const stuck = await reg.pushManager.getSubscription();
    if (stuck) await stuck.unsubscribe().catch(() => false);
    return reg.pushManager.subscribe(options);
  }
};

/**
 * Guarda no servidor para quem tem a sessão aberta. Por função da BD: o mesmo browser subscrito
 * antes por outra conta passa para esta (pela tabela era recusado e o erro ficava calado).
 */
const saveSubscription = async (sub: PushSubscription) => {
  const json = sub.toJSON();
  const { error } = await supabase.rpc(
    'rz_save_push_subscription' as never,
    {
      _endpoint: sub.endpoint,
      _p256dh: json.keys?.p256dh ?? '',
      _auth: json.keys?.auth ?? '',
      _user_agent: navigator.userAgent.slice(0, 300),
    } as never
  );
  if (error) {
    reportPushIssue('save', error.message);
    throw new Error(`O servidor não guardou a subscrição (${error.message}).`);
  }
};

/**
 * Regista no servidor porque não deu para ativar (push_issues), para se perceber sem ter o
 * aparelho da pessoa. Nunca falha nem atrasa nada.
 */
export const reportPushIssue = (state: string, detail?: string) => {
  try {
    const perm = 'Notification' in window ? Notification.permission : 'sem Notification';
    const info = `${detail ?? ''} | permissão=${perm} | sw=${'serviceWorker' in navigator} | push=${'PushManager' in window} | instalada=${isStandalone()}`;
    void (supabase as unknown as SupabaseClient)
      .from('push_issues')
      .insert({ state, detail: info.slice(0, 1000), user_agent: navigator.userAgent.slice(0, 300) })
      .then(() => undefined);
  } catch {
    // só diagnóstico: nunca interrompe
  }
};

/** O service worker da app (no máx. 5 s à espera: sem ele, `ready` nunca resolvia). */
const workerRegistration = async () => {
  const now = await registration();
  if (now) return now;
  if (!('serviceWorker' in navigator)) return undefined;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 5000)),
  ]);
};

/** Pede autorização, subscreve e guarda a subscrição deste dispositivo. */
export const enablePush = async (_userId?: string): Promise<PushState> => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    reportPushIssue('permission', `requestPermission=${permission}`);
    return permission === 'denied' ? 'denied' : 'off';
  }
  // A app instalada/publicada regista o service worker ao abrir; no localhost não há.
  const reg = await workerRegistration();
  if (!reg) {
    reportPushIssue('no-sw');
    throw new Error('Sem service worker: feche e volte a abrir a app (ou atualize com Ctrl+F5).');
  }
  let sub: PushSubscription;
  try {
    sub = await currentSubscription(reg);
  } catch (error: unknown) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    reportPushIssue('subscribe', detail);
    throw new Error(`O browser não deixou subscrever (${detail}).`);
  }
  await saveSubscription(sub);
  return 'on';
};

/**
 * Ao abrir a app: se este browser já está subscrito e autorizado, volta a guardar a subscrição
 * no servidor (pode ter saído — expirada, ou guardada noutra conta). Sem perguntar nada.
 */
export const resyncPush = async (): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await registration();
  if (!reg) return;
  const existing = await reg.pushManager.getSubscription();
  if (!existing) return;
  const sub = sameKey(existing) ? existing : await currentSubscription(reg);
  await saveSubscription(sub);
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
