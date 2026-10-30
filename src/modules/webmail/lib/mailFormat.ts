// Formatação do Webmail: nomes, datas, respostas, assinaturas e o HTML seguro do leitor.
import { format, isSameYear, isToday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { forwardedHtml, forwardedText, repliedHtml } from './forward';
import type { ComposeDraft, MailAddress, MailFolder, MailMessage, MailSummary } from '../types';

export const FOLDERS: { key: MailFolder; label: string }[] = [
  { key: 'inbox', label: 'Entrada' },
  { key: 'unread', label: 'Não lidos' },
  { key: 'starred', label: 'Com estrela' },
  { key: 'sent', label: 'Enviados' },
  { key: 'drafts', label: 'Rascunhos' },
  { key: 'archive', label: 'Arquivo' },
  { key: 'spam', label: 'Spam' },
  { key: 'trash', label: 'Lixo' },
];

export const ACCOUNT_DOTS: Record<string, string> = {
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
};

/** Linha da barra lateral (caixas e pastas). */
/** Como se chama a caixa para quem a vê: o nome que lhe deu, ou o endereço. */
export const accountName = (account: { label?: string | null; email: string }): string =>
  account.label?.trim() || account.email;

export const SIDEBAR_ROW =
  'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold transition-colors';

/** Chave única de um email (os ids só são únicos dentro da caixa). */
export const mailKey = (mail: Pick<MailSummary, 'accountId' | 'id'>) =>
  `${mail.accountId}:${mail.id}`;

export const nameOf = (address: MailAddress | null) =>
  address ? address.name?.trim() || address.email : '(sem remetente)';

export const formatAddress = (address: MailAddress) =>
  address.name ? `${address.name} <${address.email}>` : address.email;

export const formatAddressList = (list: MailAddress[]) => list.map(formatAddress).join(', ');

/** Hoje: 14:05 · este ano: 3 out · antes: 03/10/25. */
export const formatMailDate = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isSameYear(date, now)) return format(date, 'd MMM', { locale: pt });
  return format(date, 'dd/MM/yy');
};

/** Endereços escritos à mão ("a@b.pt; Ana <c@d.pt>") → só os emails válidos. */
export const parseRecipients = (value: string) =>
  value
    .split(/[,;\n]/)
    .map(part => part.match(/<([^>]+)>/)?.[1] ?? part)
    .map(part => part.trim())
    .filter(part => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part));

const prefixed = (prefix: string, subject: string) =>
  new RegExp(`^${prefix}:`, 'i').test(subject.trim()) ? subject.trim() : `${prefix}: ${subject}`;

const quote = (message: MailMessage) => {
  const when = format(new Date(message.date), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
  const body = (message.text ?? htmlToText(message.html ?? '')).trim();
  // Sem "> " no início das linhas: na caixa de escrever lê-se como texto normal (com a barra
  // ao lado), e o email sai com a citação em HTML (repliedHtml).
  return `\n\nEm ${when}, ${nameOf(message.from)} escreveu:\n${body}`;
};

/** Rascunho para responder (a todos) ou reencaminhar. */
export const draftFrom = (
  message: MailMessage,
  mode: 'reply' | 'replyAll' | 'forward',
  myEmail: string
): ComposeDraft => {
  if (mode === 'forward')
    return {
      accountId: message.accountId,
      subject: prefixed('Fwd', message.subject),
      body: forwardedText(message, message.text ?? htmlToText(message.html ?? '')),
      forward: {
        messageId: message.id,
        accountId: message.accountId,
        html: forwardedHtml(message),
        attachments: message.attachments,
      },
    };
  const replyTo = message.replyTo.length ? message.replyTo : message.from ? [message.from] : [];
  const others =
    mode === 'replyAll'
      ? [...message.to, ...message.cc].filter(a => a.email.toLowerCase() !== myEmail.toLowerCase())
      : [];
  return {
    accountId: message.accountId,
    to: formatAddressList(replyTo),
    cc: formatAddressList(others.filter(a => !replyTo.some(r => r.email === a.email))),
    subject: prefixed('Re', message.subject),
    body: quote(message),
    replyHtml: repliedHtml(message),
    inReplyTo: message.id,
  };
};

/** Corpo com a assinatura antes da citação (como no Gmail). */
export const withSignature = (body: string, signature: string | null) =>
  signature?.trim() ? `\n\n--\n${signature.trim()}${body}` : body;

export const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texto do compositor → HTML simples (parágrafos e citações). */
/**
 * Letra dos emails escritos no Realize: a mesma das assinaturas (Open Sans); onde não houver,
 * Arial. O texto, a assinatura e a pré-visualização usam todos esta.
 */
export const MAIL_FONT = "'Open Sans',Arial,Helvetica,sans-serif";

export const textToHtml = (text: string) =>
  `<div style="font-family:${MAIL_FONT};font-size:14px;line-height:1.5">${escapeHtml(text)
    .split('\n')
    .map(line =>
      line.startsWith('&gt; ') ? `<span style="color:#64748b">${line}</span>` : line || '&nbsp;'
    )
    .join('<br>')}</div>`;

/**
 * Documento para o iframe do leitor: sem scripts (o iframe é "sandbox" sem allow-scripts),
 * ligações abrem num separador novo e o texto simples aparece com quebras de linha.
 */
// O estilo do fim ganha ao do email: muitos trazem html,body{height:100%}, que prendia a altura
// medida ao tamanho inicial do quadro e cortava o texto (ex.: email da eSIM da Vodafone).
export const readerDocument = (message: Pick<MailMessage, 'html' | 'text'>) => {
  const body = message.html
    ? message.html.replace(/<script[\s\S]*?<\/script>/gi, '')
    : `<pre>${escapeHtml(message.text ?? '')}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{overflow-y:hidden}body{margin:0;padding:4px 2px;overflow-x:auto;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;line-height:1.55;color:#1e1b2e;word-wrap:break-word}
img{max-width:100%;height:auto}pre{white-space:pre-wrap;font-family:inherit}a{color:#6d28d9}
blockquote{margin:0 0 0 8px;padding-left:10px;border-left:3px solid #e2e8f0;color:#64748b}</style>
</head><body>${body}<style>html,body{height:auto!important;min-height:0!important;max-height:none!important}</style></body></html>`;
};
