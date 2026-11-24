// Anexos dos emails citados no histórico: cada cabeçalho citado ("De: … Enviada: …",
// "Em …, Fulano escreveu:") encontra o email verdadeiro na caixa (mesmo assunto, mesmo
// remetente, data mais próxima) e mostra os anexos dele no início desse bloco.
import type { QueryClient } from '@tanstack/react-query';
import { formatBytes } from '@/modules/messenger/lib/files';
import { mailService } from '../services/mailService';
import type { MailAttachmentInfo, MailMessage, MailSummary } from '../types';
import { sameName, type QuotedHeader } from './quotedHeaders';

/** Diferença máxima entre a data do cabeçalho e a do email (fusos e relógios diferentes). */
const MAX_DRIFT_MS = 26 * 60 * 60 * 1000;
/** Imagens que o Outlook põe dentro do texto (assinaturas): não são anexos de quem lê. */
const INLINE_NAME = /^image\d{3}\.(png|jpe?g|gif|bmp)$/i;

export const visibleAttachments = (message: MailMessage): MailAttachmentInfo[] =>
  message.attachments.filter(a => !INLINE_NAME.test(a.filename));

/** Assunto sem "Re:", "Fwd:", "RES:", "ENC:"… para encontrar os emails da mesma conversa. */
export const baseSubject = (subject: string) =>
  subject.replace(/^\s*((re|res|fw|fwd|enc|tr|aw|wg)\s*(\[\d+\])?\s*:\s*)+/i, '').trim();

/** O email da caixa que corresponde ao cabeçalho citado (null se não houver um certo). */
export const matchHeader = (
  header: QuotedHeader,
  candidates: MailSummary[],
  exclude: string
): MailSummary | null => {
  const bySender = candidates.filter(
    mail =>
      mail.id !== exclude &&
      !!mail.from &&
      ((header.from && mail.from.email.toLowerCase() === header.from) ||
        (!header.from && sameName(mail.from.name, header.name)))
  );
  if (!bySender.length) return null;
  if (!header.date) return bySender.length === 1 ? bySender[0] : null;
  const target = header.date.getTime();
  let best: MailSummary | null = null;
  let bestDrift = Infinity;
  for (const mail of bySender) {
    const drift = Math.abs(new Date(mail.date).getTime() - target);
    if (drift < bestDrift) {
      best = mail;
      bestDrift = drift;
    }
  }
  return bestDrift <= MAX_DRIFT_MS ? best : null;
};

/** Emails da conversa em todas as pastas (pesquisa pelo assunto), em cache. */
export const conversationCandidates = (qc: QueryClient, message: MailMessage) => {
  const subject = baseSubject(message.subject);
  return qc.fetchQuery({
    queryKey: ['mail', 'quoted-candidates', message.accountId, subject] as const,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (subject.length < 3) return [] as MailSummary[];
      const { data, error } = await mailService.list(
        message.accountId,
        'inbox',
        subject,
        null,
        null,
        null,
        false,
        [],
        { body: false }
      );
      if (error) throw error;
      return data?.messages ?? [];
    },
  });
};

/** O email completo (com a lista de anexos), partilhando a cache do leitor. */
export const loadMessage = (qc: QueryClient, mail: MailSummary) =>
  qc.fetchQuery({
    queryKey: ['mail', 'message', mail.accountId, mail.id] as const,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await mailService.get(mail.accountId, mail.id);
      if (error) throw error;
      if (!data) throw new Error('O servidor não devolveu o email.');
      return data;
    },
  });

const BAR_ATTR = 'data-rz-quoted-attachments';

/**
 * Faixa "Anexos deste email" antes do cabeçalho citado, dentro do email (iframe sem scripts:
 * os cliques são tratados aqui, na página). Não repete se já lá estiver.
 */
export const insertAttachmentBar = (
  header: QuotedHeader,
  message: MailMessage,
  attachments: MailAttachmentInfo[],
  onOpen: (attachment: MailAttachmentInfo) => void
) => {
  const doc = header.element.ownerDocument;
  const previous = header.element.previousElementSibling;
  if (!attachments.length || previous?.hasAttribute(BAR_ATTR)) return;
  const bar = doc.createElement('div');
  bar.setAttribute(BAR_ATTR, message.id);
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', `Anexos deste email (${attachments.length})`);
  bar.style.cssText =
    'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 8px;padding:8px 10px;' +
    'border-radius:12px;background:#f4f5fb;font:600 12.5px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#3f4357;';
  const label = doc.createElement('span');
  label.textContent = `📎 ${attachments.length === 1 ? 'Anexo deste email' : `${attachments.length} anexos deste email`}:`;
  bar.appendChild(label);
  for (const attachment of attachments) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = `${attachment.filename} (${formatBytes(attachment.size)})`;
    button.title = `Abrir ${attachment.filename}`;
    button.style.cssText =
      'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;' +
      'min-height:32px;padding:4px 12px;border-radius:999px;border:1px solid #d9dcea;background:#fff;' +
      'font:600 12.5px/1.2 inherit;color:#4f46e5;';
    button.addEventListener('click', () => onOpen(attachment));
    bar.appendChild(button);
  }
  header.element.parentNode?.insertBefore(bar, header.element);
};
