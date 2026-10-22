// Vista "Não lidos": o email que se abre passa a lido, mas fica na lista (como no Gmail) até
// se sair da pasta ou atualizar; senão desaparecia mal a lista se atualizasse sozinha.
import type { MailSummary } from '../types';

const same = (a: MailSummary, b: MailSummary) => a.id === b.id && a.accountId === b.accountId;

/** A lista do servidor mais os abertos nesta vista que já não vêm lá (lidos), por data. */
export const mergeKept = (live: MailSummary[], kept: MailSummary[]): MailSummary[] => {
  const missing = kept.filter(item => !live.some(mail => same(mail, item)));
  if (!missing.length) return live;
  return [...live, ...missing].sort((a, b) => b.date.localeCompare(a.date));
};

/** Junta um email aberto aos guardados (já como lido), sem repetir. */
export const keepOpened = (kept: MailSummary[], mail: MailSummary): MailSummary[] =>
  kept.some(item => same(item, mail)) ? kept : [...kept, { ...mail, unread: false }];

/** Tira os que foram para o lixo (ou já não interessam). */
export const dropKept = (kept: MailSummary[], gone: MailSummary[]): MailSummary[] =>
  kept.filter(item => !gone.some(mail => same(item, mail)));
