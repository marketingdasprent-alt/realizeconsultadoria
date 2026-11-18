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

/**
 * HTML do original para pôr dentro da nossa resposta/reencaminhamento: só o que está dentro do
 * <body>, sem <head>, <style> nem <title>. As regras de estilo do original (body{font-size:10px},
 * p{margin:0}…) aplicavam-se ao email inteiro no Outlook/Apple Mail e mudavam o nosso texto e a
 * assinatura.
 */
export const quotableHtml = (html: string): string => {
  const body = /<body\b[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(html);
  return stripActiveHtml(body ? body[1] : html)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, '');
};

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

// Caracteres invisíveis que os emails de marketing metem para encher a pré-visualização
// (travessão suave, junção de grafemas, espaços de largura zero, BOM…).
const span = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_unused, index) => from + index);
const INVISIBLE = new RegExp(
  [
    0x00ad,
    0x034f,
    0x061c,
    0x115f,
    0x1160,
    0x17b4,
    0x17b5,
    0x180e,
    0x2800,
    0x3164,
    0xfeff,
    ...span(0x200b, 0x200f),
    ...span(0x202a, 0x202e),
    ...span(0x2060, 0x206f),
  ]
    .map(code => `\\u${code.toString(16).padStart(4, '0')}`)
    .join('|'),
  'g'
);
const IMAGE_URL = /\.(?:png|jpe?g|gif|webp|svg|bmp|ico)(?:[?#]|$)/i;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Limpa o texto simples de um email para o citar numa resposta ou reencaminhamento. Muitas
 * plataformas (Odoo, Mailchimp…) geram o texto simples do HTML com notas de rodapé das ligações
 * ("[1] https://…"), marcadores "[3]" no meio das frases, "None [2]" no lugar das imagens sem
 * descrição, o nome do ficheiro das imagens ("logo [13]") e centenas de caracteres invisíveis.
 * Nada disto serve numa citação: sai tudo, e fica o texto que a pessoa lia.
 */
export const cleanPlainText = (text: string): string => {
  let out = text.replace(INVISIBLE, '');
  // Notas de rodapé: "[n] https://…" ou "[n] mailto:…" (uma por linha)
  const refs = new Map<string, string>();
  out = out.replace(
    /^[ \t]*\[(\d{1,3})\][ \t]+((?:https?:\/\/|mailto:|tel:|cid:)\S+)[ \t]*$/gim,
    (_all, n, url) => {
      refs.set(n, url);
      return '';
    }
  );
  for (const [n, url] of refs) {
    const mark = `\\[${escapeRegex(n)}\\]`;
    // Imagem: o nome do ficheiro e o marcador ("logo [13]") saem juntos
    if (IMAGE_URL.test(url)) out = out.replace(new RegExp(`[\\w.\\-]*[ \\t]*${mark}`, 'g'), '');
    // Imagem sem descrição que o gerador escreveu como "None [2]"
    out = out.replace(new RegExp(`\\bNone[ \\t]*${mark}`, 'g'), '');
    out = out.replace(new RegExp(`[ \\t]?${mark}`, 'g'), '');
  }
  return out
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Tira os "> " do início das linhas: emails em texto simples trazem a conversa anterior citada
 * assim pelo programa de quem respondeu; na nossa resposta a citação já leva a barra ao lado.
 */
export const stripQuoteMarkers = (text: string): string =>
  text.replace(/^[ \t]*(?:>[ \t]?)+/gm, '');

/** O mesmo no HTML: "&gt; " no início de cada linha (a seguir a <br>, <div>, <p> ou nova linha). */
export const stripHtmlQuoteMarkers = (html: string): string =>
  html.replace(
    /(^|<br\s*\/?>|<div[^>]*>|<p[^>]*>|\n)((?:\s|&nbsp;)*(?:&gt;|>(?![a-z/!]))(?:\s|&nbsp;)?)+/gi,
    '$1'
  );

/**
 * HTML da citação numa resposta, como no Gmail e no Outlook: "Em …, X escreveu:" e o email
 * original (HTML, com imagens) com uma barra ao lado — sem os "> " do texto simples.
 */
export const repliedHtml = (message: MailMessage): string => {
  const when = format(new Date(message.date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
  const who = message.from?.name || message.from?.email || 'Desconhecido';
  const body = message.html
    ? stripHtmlQuoteMarkers(quotableHtml(message.html))
    : `<div style="white-space:pre-wrap">${escapeHtml(cleanPlainText(stripQuoteMarkers(message.text ?? '')))}</div>`;
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
    ? quotableHtml(message.html)
    : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message.text ?? '')}</pre>`;
  return (
    `<div style="margin-top:16px"><div style="color:#64748b">${escapeHtml(FORWARD_MARKER)}</div>` +
    `<div style="margin:6px 0 12px">${header}</div></div><div>${body}</div>`
  );
};
