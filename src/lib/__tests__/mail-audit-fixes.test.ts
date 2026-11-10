// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isBounce } from '../../../supabase/functions/_shared/mail/bounce';
import { planLightMessage } from '../../../supabase/functions/_shared/mail/imap-light';
import type { ImapBodyNode } from '../../../supabase/functions/_shared/mail/imap-parse';
import { parseRecipients } from '../../../supabase/functions/_shared/mail/request';

describe('isBounce sem falsos positivos', () => {
  it('emails normais não são devoluções', () => {
    expect(isBounce('cliente@x.pt', 'Encomenda devolvida')).toBe(false);
    expect(isBounce('frota@x.pt', 'Viatura devolvida ao parque')).toBe(false);
    expect(isBounce('x@y.pt', 'Re: Undeliverable: proposta')).toBe(false);
    expect(isBounce('x@y.pt', 'Delivery Status Notification (Relay)')).toBe(false);
  });
  it('as devoluções continuam a ser reconhecidas', () => {
    expect(isBounce('x@y.pt', 'Delivery Status Notification (Failure)')).toBe(true);
    expect(isBounce('x@y.pt', 'Undeliverable: Proposta')).toBe(true);
    expect(isBounce('MAILER-DAEMON@srv.pt', 'Encomenda devolvida')).toBe(true);
  });
});

describe('destinatários separados por ;', () => {
  it('não perde ninguém', () => {
    const list = parseRecipients(['Ana <ana@x.pt>; Rui <rui@x.pt>']);
    expect(list?.map(a => a.email)).toEqual(['ana@x.pt', 'rui@x.pt']);
  });
});

describe('email dentro do email (aviso de devolução)', () => {
  it('mostra o aviso e o email embebido fica como anexo', () => {
    const root = {
      type: 'multipart/report',
      childNodes: [
        { part: '1', type: 'text/plain', size: 500 },
        { part: '2', type: 'message/delivery-status', size: 300 },
        {
          part: '3',
          type: 'message/rfc822',
          size: 900_000,
          childNodes: [
            {
              part: '3',
              type: 'multipart/alternative',
              childNodes: [
                { part: '3.1', type: 'text/plain', size: 100 },
                { part: '3.2', type: 'text/html', size: 200 },
              ],
            },
          ],
        },
      ],
    } as unknown as ImapBodyNode;
    const plan = planLightMessage(root);
    expect(plan.text?.part).toBe('1');
    expect(plan.html).toBeNull();
    expect(plan.attachments.some(a => a.mime === 'message/rfc822')).toBe(true);
  });
});

import { buildRawMessage } from '../../../supabase/functions/_shared/mail/mime';
import { asciiEmail } from '../../../supabase/functions/_shared/mail/request';

describe('nomes de anexos longos', () => {
  it('nenhuma linha passa de 998 e o nome fica em continuações RFC 2231', () => {
    const raw = buildRawMessage({
      from: { name: 'Eu', email: 'eu@x.pt' },
      to: [{ name: null, email: 'a@x.pt' }],
      cc: [],
      bcc: [],
      subject: 'x',
      text: 'x',
      html: '',
      attachments: [
        { filename: 'ç'.repeat(150) + '.pdf', mime: 'application/pdf', content: new Uint8Array(3) },
      ],
    } as unknown as Parameters<typeof buildRawMessage>[0]);
    for (const line of raw.split('\r\n')) expect(line.length).toBeLessThanOrEqual(998);
    expect(raw).toContain("filename*0*=UTF-8''");
    expect(raw).toContain('filename*1*=');
    expect(raw).not.toContain('?==?');
  });
});

describe('endereços com acentos', () => {
  it('domínio passa a punycode; acentos antes do @ são recusados', () => {
    expect(asciiEmail('joao@exämple.pt')).toBe('joao@xn--exmple-cua.pt');
    expect(asciiEmail('joão@x.pt')).toBeNull();
    expect(asciiEmail('ana@x.pt')).toBe('ana@x.pt');
  });
});
