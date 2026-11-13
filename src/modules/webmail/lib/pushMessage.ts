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

/** Caminho dentro desta app (só se o endereço for desta mesma origem). */
export const internalPath = (url: string, origin: string): string | null => {
  try {
    const target = new URL(url, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
};
