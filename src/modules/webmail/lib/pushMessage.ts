// Mensagens do service worker para a app aberta (public/push-sw.js): um email novo chegou
// ('rz-push', para mostrar o popup grande) ou a pessoa tocou no aviso do sistema ('rz-open').

export interface MailPopup {
  title: string;
  body: string;
  /** Endereço a abrir ao tocar no popup (pode ser de outra origem: aí não se usa). */
  url: string;
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Popup de email novo, ou null se a mensagem não for disso. */
export const parseMailPush = (data: unknown): MailPopup | null => {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.type !== 'rz-push' || message.kind !== 'mail') return null;
  return {
    title: text(message.title, 120) || 'Email novo',
    body: text(message.body, 240),
    url: text(message.url, 500),
  };
};

/** Endereço pedido ao tocar no aviso do sistema, ou null. */
export const parseOpenMessage = (data: unknown): string | null => {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;
  return message.type === 'rz-open' ? text(message.url, 500) || null : null;
};

/**
 * O Realize serve-se por vários endereços (app., admin. e realize.dasprent.pt) e o aviso aponta
 * sempre para o app.: quem tem a app instalada por outro endereço ficava com o botão "Abrir o
 * email" sem fazer nada (a origem não coincidia). Entre estes endereços navega-se dentro da app.
 */
/** Pedido à lista de emails (se estiver aberta) para ir buscar os emails novos já. */
export const MAIL_REFRESH_EVENT = 'rz:mail-refresh';

const SAME_APP_HOSTS = new Set([
  'app.realizeconsultadoria.pt',
  'admin.realizeconsultadoria.pt',
  'realize.dasprent.pt',
]);

/** Caminho dentro desta app (só se o endereço for desta mesma origem, ou do mesmo Realize). */
export const internalPath = (url: string, origin: string): string | null => {
  try {
    const target = new URL(url, origin);
    const here = new URL(origin);
    const sameApp = SAME_APP_HOSTS.has(target.hostname) && SAME_APP_HOSTS.has(here.hostname);
    return target.origin === here.origin || sameApp
      ? `${target.pathname}${target.search}${target.hash}`
      : null;
  } catch {
    return null;
  }
};
