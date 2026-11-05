// Reencaminhar sem passar os anexos pelo browser: o pedido de envio diz "anexos A, B, C do email
// X da caixa Y" e o servidor vai buscá-los à caixa e junta-os ao email. Assim o compositor abre
// logo e os anexos do original não contam para o limite do pedido (10 MB).

import { mailError } from '../_shared/mail/errors.ts';
import { base64ToBytes } from '../_shared/mail/mime.ts';
import type { MailDriver, OutgoingAttachment } from '../_shared/mail/types.ts';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** `limit` de cada vez, resultados pela ordem dos itens. */
const inBatches = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit)
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  return results;
};

/** Máximo do email inteiro (anexos novos + do original): o que a maioria dos servidores aceita. */
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
/** Anexos do original por email (há reencaminhamentos com mais de 100, ex.: movimentos do mês). */
const MAX_ITEMS = 300;

export interface RemoteAttachments {
  accountId: string;
  messageId: string;
  items: { id: string; filename: string | null }[];
}

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Pedido → referências (ou null se não vier nada, ou estiver mal formado). */
export const parseRemoteAttachments = (raw: unknown): RemoteAttachments | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (!isUuid(value.account_id) || typeof value.message_id !== 'string') return null;
  if (!value.message_id || value.message_id.length > 2000) return null;
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > MAX_ITEMS)
    return null;
  const items: RemoteAttachments['items'] = [];
  for (const item of value.items) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 500) return null;
    items.push({
      id: entry.id,
      filename: typeof entry.filename === 'string' ? entry.filename.slice(0, 300) : null,
    });
  }
  return { accountId: value.account_id, messageId: value.message_id, items };
};

/**
 * Descarrega os anexos (3 de cada vez) e devolve-os prontos a juntar ao envio. `alreadyBytes`:
 * o que o email já leva (texto e anexos novos), para o total não passar de MAX_TOTAL_BYTES.
 */
export const fetchRemoteAttachments = async (
  driver: MailDriver,
  remote: RemoteAttachments,
  alreadyBytes: number,
  /** O envio precisa dos bytes (Gmail, Outlook); nas caixas IMAP vai o base64 tal e qual. */
  needBytes = true
): Promise<{ attachments: OutgoingAttachment[]; bytes: Uint8Array[] }> => {
  // Vários anexos e o fornecedor sabe dá-los de uma vez (IMAP: o email é lido uma só vez)
  const many =
    remote.items.length > 3 && driver.attachmentsMany
      ? await driver.attachmentsMany(remote.messageId, remote.items).catch(error => {
          console.error('mail-api reencaminhar: anexos de uma vez falharam', errorText(error));
          return null;
        })
      : null;
  const loaded =
    many ??
    (await inBatches(remote.items, 3, async item => {
      try {
        return await driver.attachment(remote.messageId, item.id, item.filename);
      } catch (error) {
        console.error('mail-api reencaminhar: anexo falhou', item.filename, errorText(error));
        throw mailError(
          'provider_error',
          `Não foi possível juntar o anexo "${item.filename ?? 'anexo'}" do email original. Tente outra vez.`
        );
      }
    }));
  const attachments: OutgoingAttachment[] = [];
  const bytes: Uint8Array[] = [];
  let total = alreadyBytes;
  for (const file of loaded) {
    // Tamanho pelo base64 (descodificar 100+ anexos gastava o CPU da função)
    const content = needBytes ? base64ToBytes(file.base64) : new Uint8Array();
    total += needBytes ? content.length : Math.floor((file.base64.length * 3) / 4);
    if (total > MAX_TOTAL_BYTES)
      throw mailError(
        'too_large',
        'Os anexos passam de 25 MB no total. Retire alguns ou envie-os noutro email.'
      );
    attachments.push({ filename: file.filename, mime: file.mime, base64: file.base64 });
    bytes.push(content);
  }
  return { attachments, bytes };
};
