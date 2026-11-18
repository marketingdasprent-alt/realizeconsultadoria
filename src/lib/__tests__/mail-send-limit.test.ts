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

describe('limite de envio: 14 MB', () => {
  it('o limite do envio é 14 MiB e não passa o total com os anexos do original (18 MiB)', () => {
    expect(MAX_SEND_BYTES).toBe(14 * MIB);
    expect(MAX_TOTAL_BYTES).toBe(18 * MIB);
    expect(MAX_SEND_BYTES).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it('a mensagem de "grande demais" diz 14 MB', () => {
    expect(MAIL_ERROR_MESSAGES.too_large).toContain('14 MB');
    expect(MAIL_ERROR_MESSAGES.too_large).not.toContain('18 MB');
  });

  it('um anexo de 14 MiB exatos passa', () => {
    const result = send([attachment(MAX_SEND_BYTES)]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attachmentBytes[0].length).toBe(MAX_SEND_BYTES);
  });

  it('14 MiB + 1 byte falha com too_large', () => {
    expect(send([attachment(MAX_SEND_BYTES + 1)])).toEqual({ ok: false, code: 'too_large' });
  });

  it('o texto e o HTML contam para o limite', () => {
    // 14 MiB menos 10 bytes de anexo + 10 bytes de texto: no limite
    expect(send([attachment(MAX_SEND_BYTES - 10)], { text: '0123456789' }).ok).toBe(true);
    // mais um byte de HTML: acima
    expect(send([attachment(MAX_SEND_BYTES - 10)], { text: '0123456789', html: 'x' })).toEqual({
      ok: false,
      code: 'too_large',
    });
  });

  it('vários anexos somam: 7 + 7 MiB passa, 7 + 7 MiB + 1 byte falha', () => {
    expect(send([attachment(7 * MIB), attachment(7 * MIB)]).ok).toBe(true);
    expect(send([attachment(7 * MIB), attachment(7 * MIB + 1)])).toEqual({
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

  it('os 10 MB de antes passam e 15 MiB já não', () => {
    expect(send([attachment(10 * MIB + 400_000)]).ok).toBe(true);
    expect(send([attachment(15 * MIB)])).toEqual({ ok: false, code: 'too_large' });
  });
});
