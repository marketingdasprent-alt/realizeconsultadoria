// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TOTAL_BYTES,
  fetchRemoteAttachments,
  parseRemoteAttachments,
} from '../../../supabase/functions/mail-api/remoteAttachments';
import type { MailDriver } from '../../../supabase/functions/_shared/mail/types';

const ACCOUNT = '7e7d46b7-f4bb-4a11-8eb3-3b9d095dc460';

describe('parseRemoteAttachments', () => {
  it('aceita a referência e recusa pedidos mal formados', () => {
    expect(
      parseRemoteAttachments({
        account_id: ACCOUNT,
        message_id: 'INBOX:42',
        items: [{ id: 'p:2', filename: 'pedido.pdf' }],
      })
    ).toEqual({
      accountId: ACCOUNT,
      messageId: 'INBOX:42',
      items: [{ id: 'p:2', filename: 'pedido.pdf' }],
    });
    expect(parseRemoteAttachments(undefined)).toBeNull();
    expect(parseRemoteAttachments({ account_id: 'x', message_id: 'm', items: [] })).toBeNull();
    expect(
      parseRemoteAttachments({ account_id: ACCOUNT, message_id: 'm', items: [{ id: 3 }] })
    ).toBeNull();
  });
});

describe('fetchRemoteAttachments', () => {
  const driverWith = (base64: string) =>
    ({
      attachment: vi.fn(async (_m: string, id: string) => ({
        filename: `${id}.pdf`,
        mime: 'application/pdf',
        base64,
      })),
    }) as unknown as MailDriver;

  it('vai buscar todos os anexos à caixa de origem', async () => {
    const driver = driverWith(btoa('PDF'));
    const result = await fetchRemoteAttachments(
      driver,
      {
        accountId: ACCOUNT,
        messageId: 'INBOX:42',
        items: [
          { id: 'a', filename: 'a.pdf' },
          { id: 'b', filename: null },
        ],
      },
      0
    );
    expect(result.attachments.map(a => a.filename)).toEqual(['a.pdf', 'b.pdf']);
    expect(result.bytes[0]).toEqual(new TextEncoder().encode('PDF'));
  });

  it('recusa passar de 25 MB no total', async () => {
    const driver = driverWith(btoa('PDF'));
    await expect(
      fetchRemoteAttachments(
        driver,
        { accountId: ACCOUNT, messageId: 'INBOX:42', items: [{ id: 'a', filename: 'a.pdf' }] },
        MAX_TOTAL_BYTES
      )
    ).rejects.toMatchObject({ code: 'too_large' });
  });
});
