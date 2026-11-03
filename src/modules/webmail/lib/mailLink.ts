import type { MailSummary } from '../types';

/** Link que abre o Webmail já com este email aberto (usado por "Abrir em nova janela"). */
export const mailLink = (mail: Pick<MailSummary, 'accountId' | 'id'>) => {
  const search = new URLSearchParams({ conta: mail.accountId, email: mail.id });
  return `${window.location.origin}${window.location.pathname}?${search.toString()}`;
};
