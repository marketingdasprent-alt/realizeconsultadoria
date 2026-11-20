// Que emails são "novos" para os avisos: decide-se pela data de CHEGADA à caixa e nunca pela do
// cabeçalho Date, que o remetente escolhe (respostas automáticas, servidores com o relógio
// atrasado, listas e entregas atrasadas trazem datas antigas e ficavam para sempre sem aviso).

import type { MailSummary } from '../_shared/mail/types.ts';

/** Margem para relógios adiantados: uma data mais além conta como "agora" (+5 min). */
const FUTURE_SLACK_MS = 5 * 60_000;

/** Quando chegou: INTERNALDATE (IMAP) ou a data do fornecedor (Gmail e Microsoft 365 já a usam). */
export const arrivalOf = (mail: Pick<MailSummary, 'date' | 'received_at'>, now: number): number => {
  const cap = now + FUTURE_SLACK_MS;
  const ms = Date.parse(mail.received_at || mail.date);
  return Math.min(Number.isFinite(ms) ? ms : 0, cap);
};

export interface FreshPick {
  /** Os que se avisam, do mais antigo para o mais recente. */
  fresh: MailSummary[];
  /** Até onde se avisou: a chegada mais recente vista (nunca recua). */
  newest: number;
}

/**
 * `since` é o ponto de partida guardado (ms) ou null na primeira passagem, que só o marca e não
 * avisa dos antigos. Avisa os por ler que chegaram DEPOIS dele e que as regras não moveram.
 */
export const pickFresh = (
  messages: MailSummary[],
  since: number | null,
  moved: ReadonlySet<string> | undefined,
  now: number
): FreshPick => {
  const cap = now + FUTURE_SLACK_MS;
  const stored = since === null ? null : Math.min(since, cap);
  const newest = messages.reduce((max, mail) => Math.max(max, arrivalOf(mail, now)), stored ?? 0);
  const fresh =
    stored === null
      ? []
      : messages
          .filter(mail => mail.unread && !moved?.has(mail.id) && arrivalOf(mail, now) > stored)
          .sort((a, b) => arrivalOf(a, now) - arrivalOf(b, now));
  return { fresh, newest };
};
