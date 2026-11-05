import { mailService, type MailError } from '../services/mailService';

/** Acima disto (anexos em base64) o email vai direto: a fila guarda o pedido inteiro na BD. */
export const QUEUE_MAX_BYTES = 5_000_000;

const POLL_MS = 3000;
/** Depois disto o ecrã deixa de esperar: o servidor continua e avisa se falhar. */
const WAIT_MS = 5 * 60_000;

export type OutboxResult =
  | { status: 'sent' }
  | { status: 'failed'; error: MailError }
  | { status: 'pending' };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Pergunta ao servidor, de 3 em 3 s, se o email da caixa de saída já saiu. */
export const waitForOutbox = async (id: string): Promise<OutboxResult> => {
  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    const { data } = await mailService.outboxStatus([id]);
    const row = data?.find(item => item.id === id);
    if (!row) continue;
    if (row.status === 'sent') return { status: 'sent' };
    if (row.status === 'failed')
      return { status: 'failed', error: { code: 'error', message: row.last_error ?? '' } };
  }
  return { status: 'pending' };
};
