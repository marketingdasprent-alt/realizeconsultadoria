// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  base64UrlDecodeToString,
  base64UrlEncode,
  base64UrlToBase64,
  buildRawMessage,
  bytesToBase64,
  decodeBytes,
  decodeHeaderValue,
  decodeQuotedPrintable,
  encodeHeaderValue,
  extractHeader,
  formatAddressHeader,
  parseHeaderParams,
  utf8Decode,
} from '../../../supabase/functions/_shared/mail/mime';
import {
  decodeHtmlEntities,
  htmlToText,
  makeSnippet,
  replaceCidLinks,
} from '../../../supabase/functions/_shared/mail/html';

const nodeBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** Corpo de uma parte MIME (base64 em linhas) a seguir aos seus cabeçalhos. */
const partBody = (raw: string, contentType: string): string => {
  const start = raw.indexOf(`Content-Type: ${contentType}`);
  const body = raw.slice(raw.indexOf('\r\n\r\n', start) + 4);
  return body.slice(0, body.indexOf('\r\n--'));
};

describe('base64 sem Buffer', () => {
  it('codifica como o Buffer do Node, incluindo bytes e restos de 1-2 bytes', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'olá', 'Ação 🚀 çãõ']) {
      const bytes = new TextEncoder().encode(text);
      expect(bytesToBase64(bytes)).toBe(nodeBase64(bytes));
    }
    const binary = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(bytesToBase64(binary)).toBe(nodeBase64(binary));
    expect(base64ToBytes(nodeBase64(binary))).toEqual(binary);
  });

  it('base64url sem padding em ambos os sentidos (texto UTF-8 e bytes)', () => {
    const encoded = base64UrlEncode('Olá ?>> mundo ~~~');
    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlDecodeToString(encoded)).toBe('Olá ?>> mundo ~~~');
    expect(base64UrlEncode(Uint8Array.of(0xfb, 0xff))).toBe('-_8');
    expect(base64UrlToBase64('-_8')).toBe('+/8=');
  });

  it('ignora quebras de linha e recusa caracteres inválidos', () => {
    expect(utf8Decode(base64ToBytes('b2zD\r\noQ=='))).toBe('olá');
    expect(() => base64ToBytes('ab$c')).toThrow();
    // Leituras parciais: ignora lixo e o resto truncado.
    expect(utf8Decode(base64ToBytes('b2z*DoQ==', { lenient: true }))).toBe('olá');
    expect(base64ToBytes('b2zDo', { lenient: true })).toEqual(Uint8Array.of(0x6f, 0x6c, 0xc3));
  });
});

describe('cabeçalhos RFC 2047', () => {
  it('não mexe em ASCII e codifica só o que tem acentos', () => {
    expect(encodeHeaderValue('Reunião')).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(encodeHeaderValue('Relatorio mensal')).toBe('Relatorio mensal');
    expect(decodeHeaderValue(encodeHeaderValue('Reunião às 10h — sala 2 🚀'))).toBe(
      'Reunião às 10h — sala 2 🚀'
    );
  });

  it('parte textos longos em encoded-words ≤ 75 caracteres sem partir UTF-8', () => {
    const subject = 'Ação de formação obrigatória — '.repeat(6);
    const encoded = encodeHeaderValue(subject);
    for (const word of encoded.split(' ')) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeHeaderValue(encoded)).toBe(subject.trim());
  });

  it('remove quebras de linha (sem injeção de cabeçalhos)', () => {
    expect(encodeHeaderValue('Olá\r\nBcc: alvo@x.pt')).toBe(
      encodeHeaderValue('Olá Bcc: alvo@x.pt')
    );
    expect(encodeHeaderValue('Assunto\r\nBcc: alvo@x.pt')).toBe('Assunto Bcc: alvo@x.pt');
  });

  it('descodifica Q e outros charsets', () => {
    expect(decodeHeaderValue('=?ISO-8859-1?Q?Jo=E3o_Silva?=')).toBe('João Silva');
    expect(decodeHeaderValue('=?utf-8?q?Ol=C3=A1?= =?utf-8?q?_mundo?=')).toBe('Olá mundo');
    expect(decodeHeaderValue('Sem codificação')).toBe('Sem codificação');
  });

  it('codifica só o nome no endereço', () => {
    expect(formatAddressHeader({ name: 'João', email: 'joao@realize.pt' })).toMatch(
      /^=\?UTF-8\?B\?[^ ]+\?= <joao@realize\.pt>$/
    );
    expect(formatAddressHeader({ name: 'Ana', email: 'ana@realize.pt' })).toBe(
      'Ana <ana@realize.pt>'
    );
  });
});

describe('parâmetros e charsets', () => {
  it('lê Content-Type com charset e RFC 2231', () => {
    expect(parseHeaderParams('text/plain; charset="ISO-8859-1"; format=flowed')).toEqual({
      value: 'text/plain',
      params: { charset: 'ISO-8859-1', format: 'flowed' },
    });
    expect(
      parseHeaderParams("attachment; filename*=UTF-8''Relat%C3%B3rio%20final.pdf").params.filename
    ).toBe('Relatório final.pdf');
    expect(
      parseHeaderParams("attachment; filename*0*=UTF-8''Rela; filename*1*=t%C3%B3rio.pdf").params
        .filename
    ).toBe('Relatório.pdf');
  });

  it('descodifica bytes no charset indicado (fallback UTF-8)', () => {
    expect(decodeBytes(Uint8Array.of(0x4a, 0x6f, 0xe3, 0x6f), 'iso-8859-1')).toBe('João');
    expect(decodeBytes(new TextEncoder().encode('olá'), 'charset-inexistente')).toBe('olá');
    expect(utf8Decode(decodeQuotedPrintable('Ol=C3=A1 =\r\nmundo'))).toBe('Olá mundo');
  });

  it('extrai cabeçalhos dobrados', () => {
    const raw = 'Subject: x\r\nReferences: <a@x>\r\n <b@x>\r\nTo: y\r\n';
    expect(extractHeader(raw, 'references')).toBe('<a@x> <b@x>');
    expect(extractHeader(raw, 'Cc')).toBeNull();
  });
});

describe('buildRawMessage', () => {
  const base = {
    from: { name: 'Ana Silva', email: 'ana@realize.pt' },
    to: [{ name: 'Rui', email: 'rui@realize.pt' }],
    cc: [{ name: null, email: 'rh@realize.pt' }],
    bcc: [{ name: null, email: 'secreto@realize.pt' }],
    subject: 'Férias de agosto',
    text: 'Olá Rui,\nseguem as férias.',
    html: '<p>Olá Rui,</p><p>seguem as férias.</p>',
    messageId: '<abc@realize.pt>',
    date: new Date(Date.UTC(2026, 9, 15, 9, 30)),
  };

  it('monta multipart/alternative com texto e HTML em base64 UTF-8', () => {
    const raw = buildRawMessage(base);
    expect(raw).toContain('From: Ana Silva <ana@realize.pt>\r\n');
    expect(raw).toContain('To: Rui <rui@realize.pt>\r\n');
    expect(raw).toContain('Cc: rh@realize.pt\r\n');
    expect(raw).not.toContain('secreto@realize.pt');
    expect(raw).toContain('Date: Thu, 15 Oct 2026 09:30:00 +0000\r\n');
    expect(raw).toContain('Message-ID: <abc@realize.pt>\r\n');
    expect(raw).toContain('MIME-Version: 1.0\r\n');
    expect(raw).toMatch(/Content-Type: multipart\/alternative; boundary="[^"]+"/);
    expect(decodeHeaderValue(extractHeader(raw, 'Subject') ?? '')).toBe('Férias de agosto');

    const text = utf8Decode(base64ToBytes(partBody(raw, 'text/plain')));
    const html = utf8Decode(base64ToBytes(partBody(raw, 'text/html')));
    expect(text).toBe(base.text);
    expect(html).toBe(base.html);
  });

  it('inclui Bcc só quando pedido (Gmail API) e cabeçalhos de resposta', () => {
    const raw = buildRawMessage({
      ...base,
      includeBcc: true,
      inReplyTo: '<orig@x.pt>',
      references: '<a@x.pt> <orig@x.pt>',
    });
    expect(raw).toContain('Bcc: secreto@realize.pt\r\n');
    expect(raw).toContain('In-Reply-To: <orig@x.pt>\r\n');
    expect(raw).toContain('References: <a@x.pt> <orig@x.pt>\r\n');
  });

  it('usa multipart/mixed com anexos e linhas base64 ≤ 76', () => {
    const content = Uint8Array.from({ length: 5000 }, (_, i) => i % 251);
    const raw = buildRawMessage({
      ...base,
      attachments: [{ filename: 'Relatório 2026.pdf', mime: 'application/pdf', content }],
    });
    expect(raw).toMatch(/Content-Type: multipart\/mixed; boundary="([^"]+)"/);
    expect(raw).toContain(
      "Content-Disposition: attachment; filename*=UTF-8''Relat%C3%B3rio%202026.pdf"
    );
    for (const line of raw.split('\r\n')) expect(line.length).toBeLessThanOrEqual(998);

    const attachment = partBody(raw, 'application/pdf');
    for (const line of attachment.split('\r\n')) expect(line.length).toBeLessThanOrEqual(76);
    expect(base64ToBytes(attachment)).toEqual(content);

    const mixed = /boundary="(=_mix_[^"]+)"/.exec(raw)?.[1];
    expect(raw.trimEnd().endsWith(`--${mixed}--`)).toBe(true);
  });

  it('só texto quando não há HTML', () => {
    const raw = buildRawMessage({ ...base, html: '' });
    expect(raw).not.toContain('multipart/');
    expect(raw).toContain('Content-Type: text/plain; charset=UTF-8');
  });
});

describe('HTML de emails', () => {
  it('converte para texto e faz pré-visualizações', () => {
    const html =
      '<html><head><style>p{color:red}</style></head><body><p>Olá&nbsp;Rui &amp; equipa</p><p>Até já</p></body></html>';
    expect(htmlToText(html)).toBe('Olá Rui & equipa\nAté já');
    expect(makeSnippet('  muito   texto\n aqui ', 8)).toBe('muito t…');
    expect(decodeHtmlEntities('&#39;a&#x27; &atilde; &desconhecida;')).toBe("'a' ã &desconhecida;");
  });

  it('troca cid: por data: URLs conhecidas', () => {
    const html = '<img src="cid:logo@realize"><img src=\'cid:outro\'>';
    expect(replaceCidLinks(html, { 'logo@realize': 'data:image/png;base64,AAA' })).toBe(
      '<img src="data:image/png;base64,AAA"><img src=\'cid:outro\'>'
    );
  });
});
