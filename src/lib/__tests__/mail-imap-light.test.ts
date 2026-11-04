// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildLightMessage,
  planLightMessage,
} from '../../../supabase/functions/_shared/mail/imap-light';
import type { ImapBodyNode } from '../../../supabase/functions/_shared/mail/imap-parse';

const enc = (value: string) => new TextEncoder().encode(value);

// Email com texto, HTML com logótipo (cid:) e um PDF grande em anexo
const structure = {
  type: 'multipart/mixed',
  childNodes: [
    {
      part: '1',
      type: 'multipart/related',
      childNodes: [
        {
          part: '1.1',
          type: 'multipart/alternative',
          childNodes: [
            { part: '1.1.1', type: 'text/plain', parameters: { charset: 'utf-8' }, size: 40 },
            { part: '1.1.2', type: 'text/html', parameters: { charset: 'utf-8' }, size: 90 },
          ],
        },
        { part: '1.2', type: 'image/png', id: '<logo@bv>', encoding: 'base64', size: 800 },
      ],
    },
    {
      part: '2',
      type: 'application/pdf',
      disposition: 'attachment',
      dispositionParameters: { filename: 'pedido.pdf' },
      encoding: 'base64',
      size: 4_000_000,
    },
  ],
} as ImapBodyNode;

describe('planLightMessage', () => {
  it('descarrega texto, HTML e o logótipo; o PDF fica só na lista', () => {
    const plan = planLightMessage(structure);
    expect(plan.text?.part).toBe('1.1.1');
    expect(plan.html?.part).toBe('1.1.2');
    expect(plan.inline).toEqual([expect.objectContaining({ part: '1.2', cid: 'logo@bv' })]);
    expect(plan.attachments).toEqual([
      { id: 'p:2', filename: 'pedido.pdf', mime: 'application/pdf', size: 3_000_000 },
    ]);
  });

  it('imagem embebida grande passa a anexo (não atrasa a abertura)', () => {
    const big = {
      part: '1',
      type: 'image/jpeg',
      id: '<foto>',
      dispositionParameters: { filename: 'foto.jpg' },
      size: 5_000_000,
    } as ImapBodyNode;
    const plan = planLightMessage({ type: 'multipart/related', childNodes: [big] });
    expect(plan.inline).toEqual([]);
    expect(plan.attachments.map(a => a.id)).toEqual(['p:1']);
  });
});

describe('buildLightMessage', () => {
  it('monta o email e troca o cid: pela imagem', () => {
    const plan = planLightMessage(structure);
    const parts: Record<string, Uint8Array> = {
      '1.1.1': enc('Boa tarde, envio em anexo.'),
      '1.1.2': enc('<p>Boa tarde</p><img src="cid:logo@bv">'),
      '1.2': enc(btoa('PNG')),
    };
    const message = buildLightMessage({
      id: 'INBOX:42',
      plan,
      envelope: {
        subject: ' Matricula BL-54-FR ',
        from: [{ name: 'Luiz', address: 'luiz@exemplo.pt' }],
        to: [{ address: 'geral@bvseguros.pt' }],
        messageId: '<m1@exemplo.pt>',
      },
      flags: new Set(['\\Seen']),
      read: part => parts[part],
    });
    expect(message.subject).toBe('Matricula BL-54-FR');
    expect(message.text).toBe('Boa tarde, envio em anexo.');
    expect(message.html).toContain('src="data:image/png;base64,UE5H"');
    expect(message.unread).toBe(false);
    expect(message.has_attachments).toBe(true);
    expect(message.attachments[0].id).toBe('p:2');
    expect(message.message_key).toBe('m1@exemplo.pt');
  });
});
