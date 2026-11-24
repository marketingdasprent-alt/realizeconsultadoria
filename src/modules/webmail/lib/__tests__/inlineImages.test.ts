import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_fn: string, _opts: { body: Record<string, unknown> }) => ({
    data: { ok: true, data: { id: 'x' } },
    error: null,
  })),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke }, auth: { getSession: vi.fn() } },
}));

import { detachInlineImages } from '../inlineImages';
import { mailErrorText, mailService } from '../../services/mailService';

const TOKEN_A = 'N2U3ZDQ2YjctZjRiYi00YTExLThlYjMtM2I5ZDA5NWRjNDYwCklOQk9YOjQyCnA6Mg';
const TOKEN_B = 'QUFNa0FHSTJfLWI';
const marked = (token: string, data = 'iVBORw0KGgo=') =>
  `data:image/png;rz-src=${token};base64,${data}`;

describe('detachInlineImages', () => {
  it('troca as imagens marcadas por cid: e dá uma referência por imagem, mesmo repetida', () => {
    const html =
      `<p>Olá</p><img src="${marked(TOKEN_A)}" alt="logo">` +
      `<blockquote><img src='${marked(TOKEN_B, 'R0lGOD+/lhAQ==')}'>` +
      `<img src="${marked(TOKEN_A)}"></blockquote>`;
    const { html: out, images } = detachInlineImages(html);
    expect(out).toBe(
      '<p>Olá</p><img src="cid:rzimg-1@realize" alt="logo">' +
        "<blockquote><img src='cid:rzimg-2@realize'>" +
        '<img src="cid:rzimg-1@realize"></blockquote>'
    );
    expect(images).toEqual([
      { token: TOKEN_A, cid: 'rzimg-1@realize' },
      { token: TOKEN_B, cid: 'rzimg-2@realize' },
    ]);
  });

  it('imagem sem marca e texto parecido fora de uma data URL ficam intactos', () => {
    const plain = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    const text = `<p>rz-src=${TOKEN_A};base64,abc e data:image/png;rz-src= (vazio)</p>`;
    const html = plain + text;
    expect(detachInlineImages(html)).toEqual({ html, images: [] });
  });

  it('em CSS (url(...)) também troca, e não come o que vem depois da data URL', () => {
    const html = `<div style="background:url(${marked(TOKEN_A)}) no-repeat">x</div>`;
    expect(detachInlineImages(html).html).toBe(
      '<div style="background:url(cid:rzimg-1@realize) no-repeat">x</div>'
    );
  });

  it('o cid gerado passa na validação do servidor ([A-Za-z0-9._@-]{1,100})', () => {
    const many = Array.from({ length: 30 }, (_, i) => `<img src="${marked(`T${i}`)}">`).join('');
    const { images } = detachInlineImages(many);
    expect(images).toHaveLength(30);
    images.forEach(i => expect(i.cid).toMatch(/^[A-Za-z0-9._@-]{1,100}$/));
  });
});

describe('mailService com imagens citadas', () => {
  const input = {
    accountId: 'acc',
    to: ['a@b.pt'],
    cc: [],
    bcc: [],
    subject: 'Fwd: x',
    text: 'olá',
    inReplyTo: null,
    attachments: [],
  } as never;

  beforeEach(() => invoke.mockClear());

  const lastBody = () => invoke.mock.calls.at(-1)![1].body;

  it('send e queue-send mandam o HTML com cid: e inline_images', async () => {
    await mailService.send(input, `<img src="${marked(TOKEN_A)}">`);
    expect(lastBody()).toMatchObject({
      action: 'send',
      html: '<img src="cid:rzimg-1@realize">',
      inline_images: [{ token: TOKEN_A, cid: 'rzimg-1@realize' }],
    });
    await mailService.send(input, `<img src="${marked(TOKEN_A)}">`, true);
    expect(lastBody()).toMatchObject({
      action: 'queue-send',
      inline_images: [{ token: TOKEN_A, cid: 'rzimg-1@realize' }],
    });
  });

  it('rascunho também', async () => {
    await mailService.saveDraft(input, `<p>x</p><img src="${marked(TOKEN_B)}">`, null);
    expect(lastBody()).toMatchObject({
      action: 'save-draft',
      html: '<p>x</p><img src="cid:rzimg-1@realize">',
      inline_images: [{ token: TOKEN_B, cid: 'rzimg-1@realize' }],
    });
  });

  it('sem imagens marcadas o pedido fica como antes (sem inline_images)', async () => {
    const html = '<p>Olá</p><img src="data:image/png;base64,AAAA">';
    await mailService.send(input, html);
    expect(lastBody().html).toBe(html);
    expect(lastBody().inline_images).toBeUndefined();
    expect(JSON.parse(JSON.stringify(lastBody()))).not.toHaveProperty('inline_images');
  });
});

describe('mensagem de too_large', () => {
  it('mostra a do servidor quando vem; senão a nova, sem falar só de anexos', () => {
    expect(
      mailErrorText({
        code: 'too_large',
        message:
          'As imagens da conversa e os anexos passam de 18 MB. Retire alguns anexos ou apague parte da conversa citada.',
      })
    ).toContain('18 MB');
    expect(mailErrorText({ code: 'too_large', message: '' })).toBe(
      'O email passa de 14 MB (texto, imagens e anexos).'
    );
  });
});
