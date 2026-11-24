// @vitest-environment node
// Imagens da conversa citada como no Outlook (docs/webmail-imagens-citadas.md): marca no get,
// validação de inline_images e junção das imagens no envio. Tudo simulado (sem caixa real).
import { describe, expect, it, vi } from 'vitest';

// Os drivers importam o cliente Supabase por URL (só existe na função): troca-se por simulações.
vi.mock('../../../supabase/functions/_shared/mail-server/http.ts', () => ({
  errorMessage: (e: unknown) => String(e),
  fetchWithTimeout: vi.fn(),
  mapWithConcurrency: async <T, R>(
    items: T[],
    _limit: number,
    fn: (x: T, i: number) => Promise<R>
  ) => Promise.all(items.map(fn)),
}));
vi.mock('../../../supabase/functions/mail-api/session.ts', () => ({
  SEND_TIMEOUT_MS: 60_000,
  OAuthSession: class {},
}));

import {
  MAX_INLINE_IMAGES,
  decodeImageToken,
  dropCidImage,
  encodeImageToken,
  markInlineImages,
  parseInlineImages,
  partMarkedDataUrl,
} from '../../../supabase/functions/_shared/mail/inline-token';
import {
  buildLightMessage,
  planLightMessage,
} from '../../../supabase/functions/_shared/mail/imap-light';
import {
  parsedMailToMessage,
  type ImapBodyNode,
} from '../../../supabase/functions/_shared/mail/imap-parse';
import { base64UrlEncode, bytesToBase64 } from '../../../supabase/functions/_shared/mail/mime';
import type { MailDriver, MailSendParams } from '../../../supabase/functions/_shared/mail/types';
import { createGraphDriver } from '../../../supabase/functions/mail-api/drivers/graph';
import { fetchWithTimeout } from '../../../supabase/functions/_shared/mail-server/http.ts';
import { createGmailDriver } from '../../../supabase/functions/mail-api/drivers/gmail';
import {
  TOO_LARGE_MESSAGE,
  resolveQuotedImages,
} from '../../../supabase/functions/mail-api/quotedImages';
import { MAX_TOTAL_BYTES } from '../../../supabase/functions/mail-api/remoteAttachments';
import { MAX_SEND_BYTES, parseSendRequest } from '../../../supabase/functions/_shared/mail/request';
import { detachInlineImages } from '@/modules/webmail/lib/inlineImages';

const ACCOUNT = '7e7d46b7-f4bb-4a11-8eb3-3b9d095dc460';
const OTHER = '0b7c3f43-8f8e-4a4e-9c55-2e3c3b1c9a11';
const b64url = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
const enc = (value: string) => new TextEncoder().encode(value);
const PNG = bytesToBase64(enc('PNG-bytes'));

/** O token do contrato: base64url (sem =) de conta\nmensagem\nparte. */
const expectedToken = (account: string, message: string, part: string) =>
  b64url(`${account}\n${message}\n${part}`);

/** Abre como o handler: marca da parte (driver) → token final (conta + mensagem). */
const openAs = (html: string, account: string, message: string) =>
  markInlineImages(html, account, message);

const srcToken = (html: string) => /;rz-src=([A-Za-z0-9_-]+);base64,/.exec(html)?.[1] ?? null;

describe('token da imagem', () => {
  it('é base64url sem = de conta\\nmensagem\\nparte, e volta a ler-se', () => {
    const token = encodeImageToken(ACCOUNT, 'AAMk+/=x', 'p:1.2');
    expect(token).toBe(expectedToken(ACCOUNT, 'AAMk+/=x', 'p:1.2'));
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeImageToken(token)).toEqual({
      accountId: ACCOUNT,
      messageId: 'AAMk+/=x',
      attachmentId: 'p:1.2',
    });
  });

  it('recusa tokens mal formados', () => {
    expect(decodeImageToken('')).toBeNull();
    expect(decodeImageToken('a+b')).toBeNull();
    expect(decodeImageToken(b64url('nao-uuid\nm\np'))).toBeNull();
    expect(decodeImageToken(b64url(`${ACCOUNT}\nm`))).toBeNull();
    expect(decodeImageToken(b64url(`${ACCOUNT}\nm\r\np\nq`))).toBeNull();
    expect(decodeImageToken(b64url(`${ACCOUNT}\n\np`))).toBeNull();
  });
});

describe('marca no get (4 caminhos)', () => {
  it('IMAP leve: a parte é p:<parte> e o token leva conta, mensagem e parte', () => {
    const structure = {
      type: 'multipart/related',
      childNodes: [
        { part: '1', type: 'text/html', parameters: { charset: 'utf-8' }, size: 90 },
        { part: '2', type: 'image/png', id: '<logo@bv>', encoding: 'base64', size: 800 },
      ],
    } as ImapBodyNode;
    const parts: Record<string, Uint8Array> = {
      '1': enc('<p>Olá</p><img src="cid:logo@bv">'),
      '2': enc(PNG),
    };
    const message = buildLightMessage({
      id: 'INBOX:42',
      plan: planLightMessage(structure),
      read: part => parts[part],
    });
    expect(message.html).toContain(`data:image/png;rz-part=${b64url('p:2')};base64,${PNG}`);
    const html = openAs(message.html!, ACCOUNT, 'INBOX:42');
    expect(srcToken(html)).toBe(expectedToken(ACCOUNT, 'INBOX:42', 'p:2'));
    expect(html).not.toContain('rz-part');
  });

  it('mailparser: a parte é o índice do anexo; data URL que não bate certo fica sem marca', () => {
    const logo = enc('logo');
    const other = enc('outra');
    const parsed = {
      html:
        `<img src="data:image/png;base64,${bytesToBase64(logo)}">` +
        `<img src="data:image/gif;base64,AAAA">`,
      attachments: [
        { filename: 'doc.pdf', contentType: 'application/pdf', size: 3, content: enc('pdf') },
        { contentType: 'image/png', cid: 'logo@x', size: 4, content: logo },
        { contentType: 'image/gif', cid: 'gif@x', size: 5, content: other },
      ],
    };
    const message = parsedMailToMessage(parsed as never, { id: 'INBOX:7' });
    const html = openAs(message.html!, ACCOUNT, 'INBOX:7');
    expect(srcToken(html)).toBe(expectedToken(ACCOUNT, 'INBOX:7', '1'));
    // A segunda não corresponde ao conteúdo do anexo: fica como hoje
    expect(html).toContain('<img src="data:image/gif;base64,AAAA">');
  });

  const fakeSession = (routes: (url: string, init?: RequestInit) => unknown) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const session = {
      calls,
      json: vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return routes(url, init);
      }),
      fetch: vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify((routes(url, init) as object) ?? {}), { status: 202 });
      }),
      ensureOk: vi.fn(async () => undefined),
    };
    return session;
  };

  it('Microsoft Graph: a parte é o id do anexo', async () => {
    const session = fakeSession(url => {
      if (url.includes('/attachments/ATT%2B1')) {
        return { id: 'ATT+1', contentId: '<logo@m>', contentType: 'IMAGE/PNG', contentBytes: PNG };
      }
      if (url.includes('/attachments?')) {
        return {
          value: [
            { id: 'ATT+1', name: 'logo.png', contentType: 'image/png', size: 9, isInline: true },
          ],
        };
      }
      return {
        id: 'MSG=1',
        subject: 'Pedido',
        hasAttachments: true,
        receivedDateTime: '2026-11-24T09:00:00Z',
        body: { contentType: 'html', content: '<p>Olá</p><img src="cid:logo@m">' },
      };
    });
    const driver = createGraphDriver(session as never, 'https://graph/me');
    const message = await driver.get('MSG=1');
    const html = openAs(message.html!, ACCOUNT, 'MSG=1');
    expect(html).toContain('data:image/png;rz-src=');
    expect(srcToken(html)).toBe(expectedToken(ACCOUNT, 'MSG=1', 'ATT+1'));
  });

  it('Gmail: a parte é o partId (não o attachmentId, que muda)', async () => {
    const session = fakeSession(url => {
      if (url.includes('/attachments/')) return { data: b64url('PNG-bytes') };
      return {
        id: 'g1',
        threadId: 't1',
        labelIds: ['INBOX'],
        payload: {
          partId: '',
          mimeType: 'multipart/related',
          headers: [{ name: 'Subject', value: 'Olá' }],
          parts: [
            {
              partId: '0',
              mimeType: 'text/html',
              body: { data: b64url('<p>Olá</p><img src="cid:logo@g">'), size: 30 },
            },
            {
              partId: '1',
              mimeType: 'image/png',
              filename: 'logo.png',
              headers: [{ name: 'Content-ID', value: '<logo@g>' }],
              body: { attachmentId: 'ANGjdJ-muda', size: 9 },
            },
          ],
        },
      };
    });
    const driver = createGmailDriver(session as never, { email: 'a@b.pt', display_name: null });
    const message = await driver.get('g1');
    const html = openAs(message.html!, ACCOUNT, 'g1');
    expect(srcToken(html)).toBe(expectedToken(ACCOUNT, 'g1', '1'));
  });

  it('marca ilegível sai sem partir a imagem; HTML sem marcas fica igual', () => {
    const bad = `<img src="data:image/png;rz-part=%%%;base64,${PNG}">`;
    expect(openAs(bad, ACCOUNT, 'm')).toBe(bad); // não corresponde ao padrão: intacto
    const plain = `<img src="data:image/png;base64,${PNG}">`;
    expect(openAs(plain, ACCOUNT, 'm')).toBe(plain);
    expect(partMarkedDataUrl('image/png', PNG, null)).toBe(`data:image/png;base64,${PNG}`);
  });
});

describe('inline_images no pedido', () => {
  const token = encodeImageToken(ACCOUNT, 'm', 'p:2');

  it('ausente é lista vazia (pedidos de hoje continuam iguais)', () => {
    expect(parseInlineImages(undefined)).toEqual([]);
    expect(parseInlineImages(null)).toEqual([]);
  });

  it('até 100; acima disso é pedido inválido', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ token, cid: `rzimg-${i + 1}@realize` }));
    expect(parseInlineImages(many(MAX_INLINE_IMAGES))).toHaveLength(100);
    expect(parseInlineImages(many(101))).toBeNull();
  });

  it('cid só com [A-Za-z0-9._@-] até 100 caracteres; token só base64url', () => {
    expect(parseInlineImages([{ token, cid: 'rzimg-1@realize' }])).toHaveLength(1);
    for (const cid of ['', 'a b', 'a"b', 'a>b', 'x'.repeat(101), '<x@y>'])
      expect(parseInlineImages([{ token, cid }])).toBeNull();
    expect(parseInlineImages([{ token: 'a+b', cid: 'x' }])).toBeNull();
    expect(parseInlineImages([{ token: 5, cid: 'x' }])).toBeNull();
    expect(parseInlineImages('x')).toBeNull();
    expect(parseInlineImages([null])).toBeNull();
  });

  it('o mesmo cid conta uma vez (fica o primeiro, sem olhar a maiúsculas)', () => {
    const other = encodeImageToken(ACCOUNT, 'm', 'p:3');
    expect(
      parseInlineImages([
        { token, cid: 'A@r' },
        { token: other, cid: 'a@r' },
      ])
    ).toEqual([{ token, cid: 'A@r' }]);
  });
});

describe('resolveQuotedImages (envio e rascunho)', () => {
  const driverWith = (
    files: Record<string, { mime: string; base64: string } | Error>,
    extra: Partial<MailDriver> = {}
  ) =>
    ({
      attachment: vi.fn(async (_messageId: string, id: string) => {
        const file = files[id];
        if (!file || file instanceof Error) throw file ?? new Error('não existe');
        return { filename: id, ...file };
      }),
      ...extra,
    }) as unknown as MailDriver;

  const ref = (account: string, message: string, part: string, cid: string) => ({
    token: encodeImageToken(account, message, part),
    cid,
  });

  it('junta cada imagem uma vez como parte inline; refs sem cid no HTML não entram', async () => {
    const driver = driverWith({ 'p:2': { mime: 'image/png', base64: PNG } });
    const result = await resolveQuotedImages({
      refs: [
        ref(ACCOUNT, 'INBOX:1', 'p:2', 'rzimg-1@realize'),
        ref(ACCOUNT, 'INBOX:1', 'p:3', 'rzimg-2@realize'),
      ],
      html: '<img src="cid:rzimg-1@realize"><img src="cid:rzimg-1@realize">',
      alreadyBytes: 0,
      driverFor: async () => driver,
    });
    expect(result.inline).toHaveLength(1);
    expect(result.inline[0]).toMatchObject({ cid: 'rzimg-1@realize', mime: 'image/png' });
    expect(new TextDecoder().decode(result.inline[0].content)).toBe('PNG-bytes');
    expect(driver.attachment).toHaveBeenCalledTimes(1);
    expect(result.html).toBe('<img src="cid:rzimg-1@realize"><img src="cid:rzimg-1@realize">');
  });

  it('sem refs: HTML intacto e nada a juntar (pedido de hoje)', async () => {
    const driverFor = vi.fn();
    const result = await resolveQuotedImages({
      refs: [],
      html: '<p>x</p>',
      alreadyBytes: 0,
      driverFor,
    });
    expect(result).toEqual({ html: '<p>x</p>', inline: [] });
    expect(driverFor).not.toHaveBeenCalled();
  });

  it('conta de outra pessoa: recusada, a imagem sai do HTML e o email segue', async () => {
    const own = driverWith({ 'p:2': { mime: 'image/png', base64: PNG } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await resolveQuotedImages({
      refs: [ref(ACCOUNT, 'm', 'p:2', 'a@r'), ref(OTHER, 'm', 'p:2', 'b@r')],
      html: '<p>Olá</p><img alt="x" src="cid:a@r"><img width="10" src="cid:b@r" alt="y"><p>fim</p>',
      alreadyBytes: 0,
      driverFor: async id => {
        if (id !== ACCOUNT) throw new Error('forbidden');
        return own;
      },
    });
    warn.mockRestore();
    expect(result.inline.map(i => i.cid)).toEqual(['a@r']);
    expect(result.html).toBe('<p>Olá</p><img alt="x" src="cid:a@r"><p>fim</p>');
  });

  it('imagem que falha, que não é imagem ou com mais de 10 MB: sai do HTML, as outras seguem', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
    const driver = driverWith({
      'p:1': { mime: 'image/png', base64: PNG },
      'p:2': new Error('apagada'),
      'p:3': { mime: 'application/pdf', base64: PNG },
      'p:4': { mime: 'image/jpeg', base64: big },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await resolveQuotedImages({
      refs: [1, 2, 3, 4].map(n => ref(ACCOUNT, 'm', `p:${n}`, `c${n}@r`)),
      html: [1, 2, 3, 4].map(n => `<img src="cid:c${n}@r">`).join('') + 'texto',
      alreadyBytes: 0,
      driverFor: async () => driver,
    });
    warn.mockRestore();
    expect(result.inline.map(i => i.cid)).toEqual(['c1@r']);
    expect(result.html).toBe('<img src="cid:c1@r">texto');
  });

  it('token mal formado: a imagem sai do HTML sem pedir a caixa', async () => {
    const driverFor = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await resolveQuotedImages({
      refs: [{ token: b64url('lixo'), cid: 'x@r' }],
      html: '<div style="background:url(cid:x@r)">a</div><img src=\'cid:x@r\'>',
      alreadyBytes: 0,
      driverFor,
    });
    warn.mockRestore();
    expect(driverFor).not.toHaveBeenCalled();
    expect(result.html).not.toContain('cid:x@r');
    expect(result.html).toContain('>a</div>');
  });

  it('IMAP leve com mais de 3 imagens da mesma mensagem: de uma vez (attachmentsMany)', async () => {
    const attachmentsMany = vi.fn(async (_m: string, items: { id: string }[]) =>
      items.map(() => ({ filename: 'x', mime: 'image/png', base64: PNG }))
    );
    const driver = driverWith({}, { attachmentsMany } as Partial<MailDriver>);
    const refs = [1, 2, 3, 4].map(n => ref(ACCOUNT, 'INBOX:9', `p:${n}`, `c${n}@r`));
    const result = await resolveQuotedImages({
      refs,
      html: refs.map(r => `<img src="cid:${r.cid}">`).join(''),
      alreadyBytes: 0,
      driverFor: async () => driver,
    });
    expect(attachmentsMany).toHaveBeenCalledTimes(1);
    expect(driver.attachment).not.toHaveBeenCalled();
    expect(result.inline).toHaveLength(4);
  });

  it(`passa de 18 MB: too_large com a mensagem do contrato`, async () => {
    const twoMb = Buffer.alloc(2 * 1024 * 1024).toString('base64');
    const driver = driverWith({ 'p:1': { mime: 'image/png', base64: twoMb } });
    await expect(
      resolveQuotedImages({
        refs: [ref(ACCOUNT, 'm', 'p:1', 'c@r')],
        html: '<img src="cid:c@r">',
        alreadyBytes: MAX_TOTAL_BYTES - 1024 * 1024,
        driverFor: async () => driver,
      })
    ).rejects.toMatchObject({ code: 'too_large', message: TOO_LARGE_MESSAGE });
    expect(TOO_LARGE_MESSAGE).toBe(
      'As imagens da conversa e os anexos passam de 18 MB. Retire alguns anexos ou apague parte da conversa citada.'
    );
  });

  it('caso do Thiago: reencaminhamento com 1,4 MB de anexos e >14 MB de imagens na conversa citada passa', async () => {
    // 16 imagens de ~0,95 MB (como o get as mostra) espalhadas por 4 emails da conversa,
    // algumas repetidas (assinatura em cada resposta). Antes: tudo escrito no HTML (> 14 MB).
    const imageBytes = Buffer.alloc(950 * 1024, 7);
    const imageB64 = imageBytes.toString('base64');
    const quoted: string[] = [];
    for (let m = 0; m < 4; m++)
      for (let p = 0; p < 4; p++)
        quoted.push(
          `<img src="${partMarkedDataUrl('image/jpeg', imageB64, `p:${p + 2}`)}">` +
            `<img src="${partMarkedDataUrl('image/png', PNG, 'p:9')}">`
        );
    const opened = [0, 1, 2, 3]
      .map(m => openAs(quoted.slice(m * 4, m * 4 + 4).join(''), ACCOUNT, `INBOX:${m}`))
      .join('<hr>');
    const composedHtml = `<p>Segue.</p>${opened}`;
    expect(composedHtml.length).toBeGreaterThan(MAX_SEND_BYTES);

    // Ecrã: troca por cid (uma vez por imagem) e o pedido fica pequeno
    const { html, images } = detachInlineImages(composedHtml);
    expect(images).toHaveLength(4 * 4 + 4); // 16 fotos + a assinatura de cada email
    expect(html.length).toBeLessThan(50_000);

    const attachments = [
      {
        filename: 'image001.gif',
        mime: 'image/gif',
        base64: Buffer.alloc(700 * 1024).toString('base64'),
      },
      {
        filename: 'image002.png',
        mime: 'image/png',
        base64: Buffer.alloc(700 * 1024).toString('base64'),
      },
    ];
    const body = {
      account_id: ACCOUNT,
      to: ['cliente@exemplo.pt'],
      subject: 'Fwd: RE: Pedido de cotação',
      html,
      text: 'Segue.',
      attachments,
      inline_images: images,
    };
    const parsed = parseSendRequest(body);
    expect(parsed.ok).toBe(true);
    const refs = parseInlineImages(body.inline_images);
    expect(refs).toHaveLength(20);

    // Servidor: vai buscar cada imagem à caixa e junta-a uma vez
    const driver = driverWith(
      Object.fromEntries(
        [2, 3, 4, 5]
          .map(p => [`p:${p}`, { mime: 'image/jpeg', base64: imageB64 }])
          .concat([['p:9', { mime: 'image/png', base64: PNG }]])
      )
    );
    const value = (parsed as { ok: true; value: MailSendParams }).value;
    const alreadyBytes =
      value.html.length +
      value.text.length +
      value.attachments.reduce((t, a) => t + Math.floor((a.base64.length * 3) / 4), 0);
    const result = await resolveQuotedImages({
      refs: refs!,
      html: value.html,
      alreadyBytes,
      driverFor: async () => driver,
    });
    expect(result.inline).toHaveLength(20);
    const total = alreadyBytes + result.inline.reduce((t, i) => t + i.content.length, 0);
    expect(total).toBeGreaterThan(14 * 1024 * 1024);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    expect(result.html).toBe(value.html);
  });
});

describe('dropCidImage', () => {
  it('tira a tag <img> e as outras referências, sem tocar noutro cid parecido', () => {
    const html =
      '<img src="cid:a.b@r" alt="1"><img src="cid:aXb@r"><span style="background:url(\'cid:a.b@r\')">t</span>';
    const out = dropCidImage(html, 'a.b@r');
    expect(out).toContain('<img src="cid:aXb@r">');
    expect(out).not.toContain('cid:a.b@r');
    expect(out).toContain('>t</span>');
  });
});

describe('Microsoft 365: imagens citadas grandes no envio', () => {
  // Pedidos JSON do Graph têm limite de ~4 MB (anexos acima de 3 MB vão por sessão de upload).
  // Os anexos normais grandes já usam createUploadSession; as imagens inline vão sempre por POST.
  it('imagem inline de 3,5 MB não vai num POST JSON (usa sessão de upload)', async () => {
    // Os PUT da sessão de upload (o uploadUrl já vem autenticado) respondem como a Microsoft
    const puts: { headers?: HeadersInit }[] = [];
    vi.mocked(fetchWithTimeout).mockImplementation(async (_url, init) => {
      puts.push({ headers: (init as RequestInit | undefined)?.headers });
      return new Response(null, { status: 201 });
    });
    const posts: { url: string; size: number; body?: string }[] = [];
    const session = {
      json: vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.body)
          posts.push({ url, size: String(init.body).length, body: String(init.body) });
        if (url.endsWith('/createUploadSession')) return { uploadUrl: 'https://upload' };
        return { id: 'DRAFT1' };
      }),
      fetch: vi.fn(async () => new Response('{}', { status: 202 })),
      ensureOk: vi.fn(async () => undefined),
    };
    const driver = createGraphDriver(session as never, 'https://graph/me');
    await driver.send({
      to: [{ name: null, email: 'x@y.pt' }],
      cc: [],
      bcc: [],
      subject: 's',
      html: '<img src="cid:big@r">',
      text: '',
      inReplyTo: null,
      attachments: [],
      attachmentBytes: [],
      inline: [{ cid: 'big@r', mime: 'image/jpeg', content: new Uint8Array(3.5 * 1024 * 1024) }],
    });
    const biggest = Math.max(...posts.filter(p => p.url.endsWith('/attachments')).map(p => p.size));
    expect(biggest).toBeLessThan(4 * 1024 * 1024);
    // A sessão de upload leva a imagem como inline, com o Content-ID do html
    const upload = posts.find(p => p.url.endsWith('/createUploadSession'));
    expect(JSON.parse(upload?.body ?? '{}').AttachmentItem).toMatchObject({
      isInline: true,
      contentId: 'big@r',
      contentType: 'image/jpeg',
      size: 3.5 * 1024 * 1024,
    });
    expect(puts.length).toBeGreaterThan(0);
  });
});

describe('fila (queue-send)', () => {
  it('as referências são pequenas e seguem no pedido guardado (resolvem-se no envio)', () => {
    const images = Array.from({ length: 100 }, (_, i) => ({
      token: encodeImageToken(ACCOUNT, `AAMkAGI2${'x'.repeat(140)}`, `AAMkAGI2${'y'.repeat(150)}`),
      cid: `rzimg-${i + 1}@realize`,
    }));
    expect(parseInlineImages(images)).toHaveLength(100);
    // 100 referências do tamanho do Microsoft 365 ficam muito abaixo do limite da fila
    expect(JSON.stringify(images).length).toBeLessThan(60_000);
    // A fila guarda o corpo inteiro com action=send (outbox.queueSend), por isso os tokens vão juntos
    const payload = { ...{ inline_images: images, html: '<p/>' }, action: 'send' };
    expect(parseInlineImages(payload.inline_images)).toEqual(images);
  });
});

describe('base64url', () => {
  it('é o mesmo do Node (sem =)', () => {
    expect(base64UrlEncode('a\nb\nc?>')).toBe(b64url('a\nb\nc?>'));
  });
});
