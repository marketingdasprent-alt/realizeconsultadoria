// @vitest-environment node
// Rascunhos e emails IMAP enormes (o «O rascunho não abriu» do Thiago, HTTP 546 por CPU).
// Compara a descodificação nova com a antiga e testa o encolher do HTML gigante. Tudo simulado.
import { describe, expect, it } from 'vitest';
import {
  base64BytesToBytes,
  base64ToBytes,
  bytesToBase64,
  bytesToLatin1,
  decodeQuotedPrintable,
  decodeTransferEncoding,
  quotedPrintableBytesToBytes,
} from '../../../supabase/functions/_shared/mail/mime';
import {
  buildLightMessage,
  planLightMessage,
  shrinkHugeHtml,
} from '../../../supabase/functions/_shared/mail/imap-light';
import type { ImapBodyNode } from '../../../supabase/functions/_shared/mail/imap-parse';
import { markInlineImages } from '../../../supabase/functions/_shared/mail/inline-token';

const enc = (s: string) => new TextEncoder().encode(s);
/** O código antigo (antes do 4df4985), como referência. */
const oldBase64 = (bytes: Uint8Array) => {
  try {
    return base64ToBytes(bytesToLatin1(bytes), { lenient: true });
  } catch {
    return null;
  }
};
const oldQp = (bytes: Uint8Array) => decodeQuotedPrintable(bytesToLatin1(bytes));

/** Gerador determinístico (os casos repetem-se sempre iguais). */
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (r: () => number, alphabet: string, n: number) =>
  enc(Array.from({ length: n }, () => alphabet[Math.floor(r() * alphabet.length)]).join(''));

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

describe('base64 direto dos bytes = código antigo', () => {
  it('válido, com quebras de linha de 76 (como vem do servidor)', () => {
    const r = rng(1);
    for (let n = 0; n < 200; n++) {
      const raw = Uint8Array.from({ length: Math.floor(r() * 3000) }, () => Math.floor(r() * 256));
      const wire = enc(bytesToBase64(raw).replace(/(.{76})/g, '$1\r\n'));
      expect(base64BytesToBytes(wire)).toEqual(raw);
      expect(base64BytesToBytes(wire)).toEqual(oldBase64(wire));
    }
  });

  it('com lixo, espaços, = no meio, base64url e truncado', () => {
    const r = rng(2);
    const alphabet = `${B64}${B64}-_ \t\r\n=.*#é`;
    for (let n = 0; n < 400; n++) {
      const wire = pick(r, alphabet, Math.floor(r() * 500));
      const before = oldBase64(wire);
      expect(before).not.toBeNull(); // o modo lenient nunca lançava
      expect(base64BytesToBytes(wire)).toEqual(before);
    }
  });

  it('vazio e só lixo', () => {
    for (const s of ['', '====', '\r\n', '%%%', 'Q'])
      expect(base64BytesToBytes(enc(s))).toEqual(oldBase64(enc(s)));
  });
});

describe('quoted-printable direto dos bytes = código antigo', () => {
  it('casos conhecidos: =XX, quebras suaves (=\\r\\n e =\\n), = solto e hex inválido', () => {
    for (const s of [
      'Ol=C3=A1 mundo',
      'linha muito comprida =\r\ncontinua',
      'unix =\nquebra',
      'minúsculas =c3=a1',
      'igual solto = no meio',
      'hex mau =ZZ e =4',
      'fim =',
      'fim =4',
      '=3D=3D',
      '=\r sem \\n',
    ])
      expect(quotedPrintableBytesToBytes(enc(s))).toEqual(oldQp(enc(s)));
  });

  it('aleatório (sem o caso inválido «==» antes de quebra suave)', () => {
    const r = rng(3);
    const alphabet = 'abcXYZ 09=AFaf\r\n\t=;';
    let compared = 0;
    for (let n = 0; n < 600; n++) {
      const wire = pick(r, alphabet, Math.floor(r() * 300));
      // Caso raro e inválido nos dois, já registado pelo Moe (=+quebra suave a formar outro =XX)
      if (/=(=\r?\n)+[0-9A-Fa-f]/.test(bytesToLatin1(wire))) continue;
      expect(quotedPrintableBytesToBytes(wire)).toEqual(oldQp(wire));
      compared++;
    }
    expect(compared).toBeGreaterThan(300);
  });

  it('bytes acima de 127 (texto latin1 ou utf-8 cru) passam iguais', () => {
    const wire = Uint8Array.from([0x4f, 0x6c, 0xe1, 0x20, 0xc3, 0xa1, 0x3d, 0x34, 0x31]);
    expect(quotedPrintableBytesToBytes(wire)).toEqual(oldQp(wire));
  });
});

describe('decodeTransferEncoding (anexos, pré-visualizações e corpo IMAP)', () => {
  it('base64, quoted-printable e sem codificação dão o mesmo que antes', () => {
    const pdf = enc('%PDF-1.7\n…conteúdo…');
    const b64 = enc(bytesToBase64(pdf).replace(/(.{76})/g, '$1\r\n'));
    expect(decodeTransferEncoding(b64, 'BASE64')).toEqual(pdf);
    expect(decodeTransferEncoding(enc('Ol=C3=A1=\r\n!'), 'quoted-printable')).toEqual(enc('Olá!'));
    expect(decodeTransferEncoding(pdf, '7bit')).toBe(pdf);
    expect(decodeTransferEncoding(pdf, null)).toBe(pdf);
  });
});

describe('shrinkHugeHtml', () => {
  const big = (n: number) => 'A'.repeat(n);
  const MB = 1024 * 1024;

  it('acima de 4 MB: imagens grandes passam a [imagem], texto e imagens pequenas ficam', () => {
    const smallMarked = `data:image/png;rz-part=cDox;base64,${big(2000)}`;
    const html =
      `<p>Bom dia, segue a proposta revista.</p>` +
      `<img src="${smallMarked}" alt="logo">` +
      Array.from(
        { length: 5 },
        (_, i) => `<p>Foto ${i}</p><img width="600" src='data:image/jpeg;base64,${big(MB)}'>`
      ).join('') +
      `<p>Cumprimentos, Thiago</p>`;
    expect(html.length).toBeGreaterThan(4 * MB);
    const out = shrinkHugeHtml(html);
    expect(out.length).toBeLessThan(10_000);
    expect(out.match(/\[imagem\]/g)).toHaveLength(5);
    expect(out).toContain('<p>Bom dia, segue a proposta revista.</p>');
    expect(out).toContain('<p>Cumprimentos, Thiago</p>');
    expect(out).toContain('<p>Foto 4</p>');
    // A imagem pequena continua, com a marca (o envio volta a buscá-la)
    expect(out).toContain(`<img src="${smallMarked}" alt="logo">`);
    expect(
      markInlineImages(out, '7e7d46b7-f4bb-4a11-8eb3-3b9d095dc460', 'INBOX.Drafts:42')
    ).toContain(';rz-src=');
  });

  it('abaixo de 4 MB não muda nada, mesmo com imagens grandes', () => {
    const html = `<p>x</p><img src="data:image/jpeg;base64,${big(3 * MB)}">`;
    expect(shrinkHugeHtml(html)).toBe(html);
  });

  it('acima de 4 MB, imagens de 100 KB ou menos não mudam', () => {
    const small = `<img src="data:image/png;base64,${big(100 * 1024 - 20)}">`;
    const html = small.repeat(45);
    expect(html.length).toBeGreaterThan(4 * MB);
    expect(shrinkHugeHtml(html)).toBe(html);
  });
});

describe('buildLightMessage com um rascunho gigante', () => {
  it('HTML base64 de >4 MB com imagens escritas: abre com o texto e sem as imagens grandes', () => {
    const structure = {
      type: 'multipart/related',
      childNodes: [
        {
          part: '1',
          type: 'text/html',
          parameters: { charset: 'utf-8' },
          encoding: 'base64',
          size: 9_000_000,
        },
        { part: '2', type: 'image/png', id: '<logo@x>', encoding: 'base64', size: 800 },
      ],
    } as ImapBodyNode;
    const photo = Buffer.alloc(1.2 * 1024 * 1024, 7).toString('base64');
    const html =
      '<p>Texto que o Thiago escreveu.</p><img src="cid:logo@x">' +
      Array.from(
        { length: 4 },
        () => `<blockquote><img src="data:image/jpeg;base64,${photo}"></blockquote>`
      ).join('');
    const parts: Record<string, Uint8Array> = {
      '1': enc(
        Buffer.from(html, 'utf8')
          .toString('base64')
          .replace(/(.{76})/g, '$1\r\n')
      ),
      '2': enc(bytesToBase64(enc('PNG'))),
    };
    const message = buildLightMessage({
      id: 'INBOX.Drafts:42',
      plan: planLightMessage(structure),
      read: part => parts[part],
    });
    expect(message.html).toContain('<p>Texto que o Thiago escreveu.</p>');
    expect(message.html!.match(/\[imagem\]/g)).toHaveLength(4);
    expect(message.html).toContain(
      `data:image/png;rz-part=${Buffer.from('p:2').toString('base64url')};base64,`
    );
    expect(message.html!.length).toBeLessThan(5_000);
  });

  it('email normal (abaixo de 4 MB): igual ao de antes', () => {
    const structure = {
      type: 'multipart/related',
      childNodes: [
        {
          part: '1',
          type: 'text/html',
          parameters: { charset: 'utf-8' },
          encoding: 'quoted-printable',
          size: 90,
        },
        { part: '2', type: 'image/png', id: '<logo@x>', encoding: 'base64', size: 800 },
      ],
    } as ImapBodyNode;
    const parts: Record<string, Uint8Array> = {
      '1': enc('<p>Ol=C3=A1</p><img src=3D"cid:logo@x">=\r\n<p>fim</p>'),
      '2': enc(bytesToBase64(enc('PNG'))),
    };
    const message = buildLightMessage({
      id: 'INBOX:1',
      plan: planLightMessage(structure),
      read: p => parts[p],
    });
    expect(message.html).toBe(
      `<p>Olá</p><img src="data:image/png;rz-part=${Buffer.from('p:2').toString('base64url')};base64,UE5H"><p>fim</p>`
    );
  });
});
