// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatAddress,
  formatAddressList,
  isValidEmail,
  parseAddress,
  parseAddressList,
} from '../../../supabase/functions/_shared/mail/address';
import {
  isPublicMailHost,
  parseImapConnectRequest,
  parseListLimit,
  parseRecipients,
  parseSendRequest,
} from '../../../supabase/functions/_shared/mail/request';

describe('parseAddress', () => {
  it('lê "Nome <email>", nomes entre aspas e email simples', () => {
    expect(parseAddress('Ana Silva <ana@realize.pt>')).toEqual({
      name: 'Ana Silva',
      email: 'ana@realize.pt',
    });
    expect(parseAddress('"Silva, Ana" <ana@realize.pt>')).toEqual({
      name: 'Silva, Ana',
      email: 'ana@realize.pt',
    });
    expect(parseAddress('"Rui \\"RH\\" Costa" <rui@realize.pt>')?.name).toBe('Rui "RH" Costa');
    expect(parseAddress('  ana@realize.pt ')).toEqual({ name: null, email: 'ana@realize.pt' });
    expect(parseAddress('<ana@realize.pt>')).toEqual({ name: null, email: 'ana@realize.pt' });
  });

  it('aceita o formato com comentário e ignora nomes iguais ao email', () => {
    expect(parseAddress('ana@realize.pt (Ana Silva)')).toEqual({
      name: 'Ana Silva',
      email: 'ana@realize.pt',
    });
    expect(parseAddress('ana@realize.pt <ana@realize.pt>')).toEqual({
      name: null,
      email: 'ana@realize.pt',
    });
  });

  it('devolve null para entradas vazias', () => {
    expect(parseAddress('')).toBeNull();
    expect(parseAddress('   ')).toBeNull();
    expect(parseAddress('Ninguém <>')).toBeNull();
  });
});

describe('parseAddressList', () => {
  it('separa por vírgulas fora de aspas e de <>', () => {
    const list = parseAddressList(
      '"Silva, Ana" <ana@realize.pt>, rui@realize.pt; Marta <marta@realize.pt>'
    );
    expect(list).toEqual([
      { name: 'Silva, Ana', email: 'ana@realize.pt' },
      { name: null, email: 'rui@realize.pt' },
      { name: 'Marta', email: 'marta@realize.pt' },
    ]);
  });

  it('trata grupos RFC 5322 e listas vazias', () => {
    expect(parseAddressList('Equipa: a@x.pt, b@x.pt;')).toEqual([
      { name: null, email: 'a@x.pt' },
      { name: null, email: 'b@x.pt' },
    ]);
    expect(parseAddressList('undisclosed-recipients:;')).toEqual([]);
    expect(parseAddressList(null)).toEqual([]);
    expect(parseAddressList(' , ')).toEqual([]);
  });
});

describe('formatAddress', () => {
  it('só usa aspas quando o nome tem caracteres especiais', () => {
    expect(formatAddress({ name: 'Ana Silva', email: 'ana@realize.pt' })).toBe(
      'Ana Silva <ana@realize.pt>'
    );
    expect(formatAddress({ name: 'Silva, Ana', email: 'ana@realize.pt' })).toBe(
      '"Silva, Ana" <ana@realize.pt>'
    );
    expect(formatAddress({ name: 'Rui "RH"', email: 'rui@realize.pt' })).toBe(
      '"Rui \\"RH\\"" <rui@realize.pt>'
    );
    expect(formatAddress({ name: null, email: 'rui@realize.pt' })).toBe('rui@realize.pt');
  });

  it('volta a dar a mesma lista depois de formatar e ler', () => {
    const list = [
      { name: 'Silva, Ana', email: 'ana@realize.pt' },
      { name: null, email: 'rui@realize.pt' },
    ];
    expect(parseAddressList(formatAddressList(list))).toEqual(list);
  });
});

describe('isValidEmail', () => {
  it('aceita endereços normais e recusa os incompletos', () => {
    expect(isValidEmail('ana.silva+rh@realize.pt')).toBe(true);
    expect(isValidEmail('ana@realize')).toBe(false);
    expect(isValidEmail('ana realize.pt')).toBe(false);
    expect(isValidEmail('ana@@realize.pt')).toBe(false);
  });
});

describe('validação dos pedidos ao mail-api', () => {
  it('limita o número de mensagens por página entre 1 e 50 (25 por omissão)', () => {
    expect(parseListLimit(undefined)).toBe(25);
    expect(parseListLimit(500)).toBe(50);
    expect(parseListLimit(0)).toBe(1);
    expect(parseListLimit('10')).toBe(10);
  });

  it('valida destinatários (strings, também com vírgulas)', () => {
    expect(parseRecipients(['Ana <ana@realize.pt>', 'rui@realize.pt, marta@realize.pt'])).toEqual([
      { name: 'Ana', email: 'ana@realize.pt' },
      { name: null, email: 'rui@realize.pt' },
      { name: null, email: 'marta@realize.pt' },
    ]);
    expect(parseRecipients(['sem-arroba'])).toBeNull();
    expect(parseRecipients('ana@realize.pt')).toBeNull();
    expect(parseRecipients(undefined)).toEqual([]);
  });

  it('recusa envios sem destinatários, com anexos inválidos ou acima de 10 MB', () => {
    expect(parseSendRequest({ to: [], subject: 'x', html: '', text: 'x' })).toEqual({
      ok: false,
      code: 'invalid_recipient',
    });
    expect(
      parseSendRequest({
        to: ['ana@realize.pt'],
        attachments: [{ filename: 'a.txt', mime: 'text/plain', base64: '***' }],
      })
    ).toEqual({ ok: false, code: 'bad_request' });
    const big = 'A'.repeat(14 * 1024 * 1024);
    expect(
      parseSendRequest({
        to: ['ana@realize.pt'],
        attachments: [{ filename: 'a.bin', mime: 'application/octet-stream', base64: big }],
      })
    ).toEqual({ ok: false, code: 'too_large' });
  });

  it('descodifica os anexos válidos', () => {
    const result = parseSendRequest({
      to: ['ana@realize.pt'],
      bcc: ['rh@realize.pt'],
      subject: 'Olá',
      html: '<p>Olá</p>',
      text: 'Olá',
      in_reply_to: 'abc',
      attachments: [{ filename: 'a.txt', mime: 'text/plain', base64: 'b2zDoQ==' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bcc).toEqual([{ name: null, email: 'rh@realize.pt' }]);
    expect(result.value.inReplyTo).toBe('abc');
    expect(new TextDecoder().decode(result.value.attachmentBytes[0])).toBe('olá');
  });

  it('só aceita SMTP na porta 465 e servidores públicos', () => {
    const base = {
      provider: 'icloud',
      email: 'Ana@iCloud.com',
      password: 'app-password',
      imap_host: 'imap.mail.me.com',
      imap_port: 993,
      smtp_host: 'smtp.mail.me.com',
      smtp_port: 465,
    };
    const ok = parseImapConnectRequest(base);
    expect(ok.ok && ok.value.email).toBe('ana@icloud.com');
    expect(parseImapConnectRequest({ ...base, smtp_port: 587 })).toEqual({
      ok: false,
      code: 'smtp_port_blocked',
    });
    expect(parseImapConnectRequest({ ...base, imap_host: 'localhost' })).toEqual({
      ok: false,
      code: 'bad_request',
    });
    expect(isPublicMailHost('10.0.0.5')).toBe(false);
    expect(isPublicMailHost('192.168.1.10')).toBe(false);
    expect(isPublicMailHost('mail.exemplo.pt')).toBe(true);
  });
});
