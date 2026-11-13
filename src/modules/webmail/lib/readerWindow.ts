import type { MailSummary } from '../types';
import { mailLink } from './mailLink';

/** As janelas que só mostram um email têm um nome que começa assim (e que sobrevive a recarregar). */
const PREFIX = 'rz-leitor:';

/** Esta janela foi aberta só para ler um email (duplo clique na lista): sem menu nem lista. */
export const isReaderWindow = () => typeof window !== 'undefined' && window.name.startsWith(PREFIX);

/**
 * Abre o email numa janela própria, como o Outlook ao dar duplo clique. O mesmo email volta à
 * mesma janela. Devolve false se o navegador bloqueou a janela.
 */
export const openReaderWindow = (mail: Pick<MailSummary, 'accountId' | 'id'>): boolean => {
  const width = Math.min(1100, Math.max(640, window.screen.availWidth - 120));
  const height = Math.min(860, Math.max(560, window.screen.availHeight - 120));
  const left = Math.round(window.screenX + 50);
  const top = Math.round(window.screenY + 50);
  const next = window.open(
    mailLink(mail),
    `${PREFIX}${mail.accountId}:${mail.id}`,
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`
  );
  if (!next) return false;
  next.focus();
  return true;
};
