// Reencaminhar o email todo: cabeçalho da mensagem original, o corpo tal como veio (HTML, com
// as imagens e a assinatura de quem o enviou) e os anexos.
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { MailAddress, MailMessage } from '../types';

export const FORWARD_MARKER = '---------- Mensagem reencaminhada ----------';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const list = (addresses: MailAddress[]) =>
  addresses.map(a => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', ');

/** Tira o que pode correr código (scripts, eventos, javascript:) do HTML do email original. */
export const stripActiveHtml = (html: string): string =>
  html
    .replace(/<(script|iframe|object)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(embed|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');

const headerLines = (message: MailMessage): { label: string; value: string }[] => {
  const when = format(new Date(message.date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
  return [
    { label: 'De', value: message.from ? list([message.from]) : '' },
    { label: 'Data', value: when },
    { label: 'Assunto', value: message.subject },
    { label: 'Para', value: list(message.to) },
    ...(message.cc.length ? [{ label: 'Cc', value: list(message.cc) }] : []),
  ].filter(line => line.value);
};

/** Texto do reencaminhamento (para quem não lê HTML e para o campo de escrita). */
export const forwardedText = (message: MailMessage, bodyText: string): string =>
  `\n\n${FORWARD_MARKER}\n${headerLines(message)
    .map(line => `${line.label}: ${line.value}`)
    .join('\n')}\n\n${bodyText.trim()}`;

/**
 * HTML da citação numa resposta, como no Gmail e no Outlook: "Em …, X escreveu:" e o email
 * original (HTML, com imagens) com uma barra ao lado — sem os "> " do texto simples.
 */
export const repliedHtml = (message: MailMessage): string => {
  const when = format(new Date(message.date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
  const who = message.from?.name || message.from?.email || 'Desconhecido';
  const body = message.html
    ? stripActiveHtml(message.html)
    : `<div style="white-space:pre-wrap">${escapeHtml(message.text ?? '')}</div>`;
  return (
    `<div style="margin-top:16px;color:#64748b">Em ${escapeHtml(when)}, ${escapeHtml(who)} escreveu:</div>` +
    `<blockquote style="margin:6px 0 0 0;padding-left:12px;border-left:2px solid #cbd5e1">${body}</blockquote>`
  );
};

/** HTML do reencaminhamento: o cabeçalho e o corpo original, como veio. */
export const forwardedHtml = (message: MailMessage): string => {
  const header = headerLines(message)
    .map(line => `<b>${line.label}:</b> ${escapeHtml(line.value)}`)
    .join('<br>');
  const body = message.html
    ? stripActiveHtml(message.html)
    : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message.text ?? '')}</pre>`;
  return (
    `<div style="margin-top:16px"><div style="color:#64748b">${escapeHtml(FORWARD_MARKER)}</div>` +
    `<div style="margin:6px 0 12px">${header}</div></div><div>${body}</div>`
  );
};
