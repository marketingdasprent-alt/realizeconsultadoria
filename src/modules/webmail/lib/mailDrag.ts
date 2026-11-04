import type { MailSummary } from '../types';

/** Marca do arrastar de emails (o resto do navegador ignora-a). */
export const MAIL_DRAG_TYPE = 'application/x-realize-mail';

// O navegador só deixa ler o conteúdo de um arrastar ao largar: durante o arrastar guardam-se
// aqui os emails (para saber já se a pasta ou o marcador por cima aceita, ou não).
let dragged: MailSummary[] = [];

export const startMailDrag = (event: React.DragEvent, mails: MailSummary[]) => {
  dragged = mails;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(MAIL_DRAG_TYPE, String(mails.length));
  event.dataTransfer.setData('text/plain', mails.map(mail => mail.subject).join('\n'));
};

export const endMailDrag = () => {
  dragged = [];
};

export const draggedMails = (): MailSummary[] => dragged;

/** Arrasta-se agora um email da caixa `accountId` (as pastas e marcadores são de cada caixa). */
export const canDropOn = (accountId: string): boolean =>
  dragged.length > 0 && dragged.every(mail => mail.accountId === accountId);
