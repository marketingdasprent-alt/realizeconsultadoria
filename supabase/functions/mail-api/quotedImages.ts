// Imagens da conversa citada (respostas e reencaminhamentos) como o Outlook: o pedido de envio
// traz só referências `{ token, cid }` (inline_images) e o servidor vai buscar cada imagem à
// caixa de origem e junta-a uma vez ao email como parte inline (Content-ID). Assim as imagens não
// vão escritas no HTML nem contam para os 14 MB do pedido (contrato: docs/webmail-imagens-citadas.md).

import { mailError } from '../_shared/mail/errors.ts';
import {
  decodeImageToken,
  dropCidImage,
  type ImageSource,
  type InlineImageRef,
} from '../_shared/mail/inline-token.ts';
import { base64ToBytes, type RawInlineImage } from '../_shared/mail/mime.ts';
import type { MailDriver } from '../_shared/mail/types.ts';
import { MAX_TOTAL_BYTES } from './remoteAttachments.ts';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const TOO_LARGE_MESSAGE =
  'As imagens da conversa e os anexos passam de 18 MB. Retire alguns anexos ou apague parte da conversa citada.';

/** Uma imagem citada passa disto: não entra (uma foto enorme não deve travar o envio). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface Pending extends ImageSource {
  cid: string;
}

/** `limit` de cada vez, resultados pela ordem dos itens. */
const inBatches = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit)
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  return results;
};

type Loaded = { mime: string; base64: string } | null;

/** As imagens de uma mensagem: de uma vez no IMAP leve (p:<parte>), senão 3 de cada vez. */
const loadFromMessage = async (
  driver: MailDriver,
  messageId: string,
  items: Pending[]
): Promise<Loaded[]> => {
  if (
    items.length > 3 &&
    driver.attachmentsMany &&
    items.every(i => i.attachmentId.startsWith('p:'))
  )
    try {
      return await driver.attachmentsMany(
        messageId,
        items.map(i => ({ id: i.attachmentId, filename: null }))
      );
    } catch (error) {
      console.warn('mail-api imagens citadas: de uma vez falharam', errorText(error));
    }
  return inBatches(items, 3, async item => {
    try {
      return await driver.attachment(messageId, item.attachmentId);
    } catch (error) {
      console.warn('mail-api imagens citadas: imagem falhou', errorText(error));
      return null;
    }
  });
};

/**
 * Descarrega as imagens citadas e devolve-as prontas a juntar ao envio, com o HTML sem as que
 * falharam (token inválido, conta de outra pessoa, imagem apagada, não é imagem): o email sai
 * sem elas. `driverFor(accountId)` tem de recusar contas que não sejam do utilizador.
 * `alreadyBytes`: o que o email já leva (texto e anexos), para o total ficar em MAX_TOTAL_BYTES.
 */
export const resolveQuotedImages = async (input: {
  refs: InlineImageRef[];
  html: string;
  alreadyBytes: number;
  driverFor: (accountId: string) => Promise<MailDriver>;
}): Promise<{ html: string; inline: RawInlineImage[] }> => {
  let html = input.html;
  if (!input.refs.length) return { html, inline: [] };

  const failed: string[] = [];
  const pending: Pending[] = [];
  for (const ref of input.refs) {
    // Só as que o HTML ainda usa (a pessoa pode ter apagado a citação)
    if (!html.toLowerCase().includes(`cid:${ref.cid.toLowerCase()}`)) continue;
    const source = decodeImageToken(ref.token);
    if (source) pending.push({ ...source, cid: ref.cid });
    else failed.push(ref.cid);
  }

  // Por conta e por mensagem
  const byAccount = new Map<string, Map<string, Pending[]>>();
  for (const item of pending) {
    const messages = byAccount.get(item.accountId) ?? new Map<string, Pending[]>();
    messages.set(item.messageId, [...(messages.get(item.messageId) ?? []), item]);
    byAccount.set(item.accountId, messages);
  }

  const loaded = new Map<string, { mime: string; content: Uint8Array }>();
  for (const [accountId, messages] of byAccount) {
    let driver: MailDriver;
    try {
      driver = await input.driverFor(accountId);
    } catch (error) {
      console.warn('mail-api imagens citadas: conta recusada', errorText(error));
      for (const items of messages.values()) failed.push(...items.map(i => i.cid));
      continue;
    }
    for (const [messageId, items] of messages) {
      const files = await loadFromMessage(driver, messageId, items);
      items.forEach((item, index) => {
        const file = files[index];
        const mime = (file?.mime ?? '').toLowerCase();
        let content: Uint8Array | null = null;
        if (file && mime.startsWith('image/')) {
          try {
            content = base64ToBytes(file.base64);
          } catch {
            content = null;
          }
        }
        if (!file || !content || !content.length || content.length > MAX_IMAGE_BYTES) {
          failed.push(item.cid);
          return;
        }
        loaded.set(item.cid, { mime, content });
      });
    }
  }

  const inline: RawInlineImage[] = [];
  let total = input.alreadyBytes;
  for (const ref of input.refs) {
    const file = loaded.get(ref.cid);
    if (!file) continue;
    total += file.content.length;
    if (total > MAX_TOTAL_BYTES) throw mailError('too_large', TOO_LARGE_MESSAGE);
    inline.push({ cid: ref.cid, mime: file.mime, content: file.content });
  }

  if (failed.length)
    console.warn(`mail-api imagens citadas: ${failed.length} sem juntar (o email sai sem elas)`);
  for (const cid of failed) html = dropCidImage(html, cid);
  return { html, inline };
};
