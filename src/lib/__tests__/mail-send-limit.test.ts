// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAIL_ERROR_MESSAGES } from '../../../supabase/functions/_shared/mail/errors';
import { MAX_SEND_BYTES, parseSendRequest } from '../../../supabase/functions/_shared/mail/request';
import { MAX_TOTAL_BYTES } from '../../../supabase/functions/mail-api/remoteAttachments';

const MIB = 1024 * 1024;

/** Anexo com `size` bytes, já em base64 (como o ecrã o envia, sem quebras de linha). */
const attachment = (size: number) => ({
  filename: 'a.bin',
  mime: 'application/octet-stream',
  base64: Buffer.alloc(size, 7).toString('base64'),
});

const send = (attachments: object[], over: Record<string, unknown> = {}) =>
  parseSendRequest({
    to: ['ana@realize.pt'],
    subject: 'x',
    html: '',
    text: '',
    attachments,
    ...over,
  });

describe('limite de envio: 18 MB', () => {
  it('o limite do envio é 18 MiB, igual ao total com os anexos do original', () => {
    expect(MAX_SEND_BYTES).toBe(18 * MIB);
    expect(MAX_TOTAL_BYTES).toBe(MAX_SEND_BYTES);
  });

  it('a mensagem de "grande demais" diz 18 MB', () => {
    expect(MAIL_ERROR_MESSAGES.too_large).toContain('18 MB');
    expect(MAIL_ERROR_MESSAGES.too_large).not.toContain('10 MB');
  });

  it('um anexo de 18 MiB exatos passa', () => {
    const result = send([attachment(MAX_SEND_BYTES)]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attachmentBytes[0].length).toBe(MAX_SEND_BYTES);
  });

  it('18 MiB + 1 byte falha com too_large', () => {
    expect(send([attachment(MAX_SEND_BYTES + 1)])).toEqual({ ok: false, code: 'too_large' });
  });

  it('o texto e o HTML contam para o limite', () => {
    // 18 MiB menos 10 bytes de anexo + 10 bytes de texto: no limite
    expect(send([attachment(MAX_SEND_BYTES - 10)], { text: '0123456789' }).ok).toBe(true);
    // mais um byte de HTML: acima
    expect(send([attachment(MAX_SEND_BYTES - 10)], { text: '0123456789', html: 'x' })).toEqual({
      ok: false,
      code: 'too_large',
    });
  });

  it('vários anexos somam: 9 + 9 MiB passa, 9 + 9 MiB + 1 byte falha', () => {
    expect(send([attachment(9 * MIB), attachment(9 * MIB)]).ok).toBe(true);
    expect(send([attachment(9 * MIB), attachment(9 * MIB + 1)])).toEqual({
      ok: false,
      code: 'too_large',
    });
  });

  it('muito acima do limite recusa pela estimativa, sem descodificar', () => {
    const huge = {
      filename: 'a.bin',
      mime: 'application/octet-stream',
      base64: 'A'.repeat(40 * MIB),
    };
    expect(send([huge])).toEqual({ ok: false, code: 'too_large' });
  });

  it('os 10 MB de antes passam agora', () => {
    expect(send([attachment(10 * MIB + 400_000)]).ok).toBe(true);
  });
});
