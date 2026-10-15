import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseDomain, discoverServers, parseIspdb } from '../autodiscover';

const XML = `<?xml version="1.0"?>
<clientConfig version="1.1"><emailProvider id="sapo.pt">
  <incomingServer type="pop3"><hostname>pop.sapo.pt</hostname><port>995</port><socketType>SSL</socketType></incomingServer>
  <incomingServer type="imap"><hostname>imap.sapo.pt</hostname><port>143</port><socketType>STARTTLS</socketType></incomingServer>
  <incomingServer type="imap"><hostname>imap.sapo.pt</hostname><port>993</port><socketType>SSL</socketType></incomingServer>
  <outgoingServer type="smtp"><hostname>smtp.sapo.pt</hostname><port>587</port><socketType>STARTTLS</socketType></outgoingServer>
  <outgoingServer type="smtp"><hostname>smtp.sapo.pt</hostname><port>465</port><socketType>SSL</socketType></outgoingServer>
</emailProvider></clientConfig>`;

const respond = (routes: Record<string, unknown>) =>
  vi.fn(async (url: string) => {
    const key = Object.keys(routes).find(k => url.includes(k));
    const body = key ? routes[key] : null;
    return {
      ok: body !== null,
      text: async () => String(body),
      json: async () => body,
    } as Response;
  });

afterEach(() => vi.unstubAllGlobals());

describe('descoberta de servidores de email', () => {
  it('lê o ISPDB e prefere SSL (993/465)', () => {
    expect(parseIspdb(XML)).toEqual({
      imapHost: 'imap.sapo.pt',
      imapPort: 993,
      smtpHost: 'smtp.sapo.pt',
      smtpPort: 465,
    });
    expect(parseIspdb('<clientConfig/>')).toBeNull();
  });

  it('domínio base do MX', () => {
    expect(baseDomain('mx1.ptisp.pt.')).toBe('ptisp.pt');
    expect(baseDomain('mail.empresa.com.br')).toBe('empresa.com.br');
  });

  it('Gmail e Outlook vão para OAuth sem pedir nada à rede', async () => {
    const fetch = respond({});
    vi.stubGlobal('fetch', fetch);
    expect((await discoverServers('a@gmail.com'))?.oauth).toBe('gmail');
    expect((await discoverServers('a@hotmail.com'))?.oauth).toBe('office365');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Google Workspace e Microsoft 365 pelo MX', async () => {
    vi.stubGlobal(
      'fetch',
      respond({ 'type=MX': { Answer: [{ type: 15, data: '1 aspmx.l.google.com.' }] } })
    );
    expect(await discoverServers('rh@empresa.pt')).toMatchObject({ oauth: 'gmail', source: 'mx' });
  });

  it('cPanel: segue o MX até ao nome real do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        'type=MX': { Answer: [{ type: 15, data: '0 _dc-mx.88063ec0f1b1.razao.pt.' }] },
        'type=A': { Answer: [{ type: 1, data: '185.12.116.27' }] },
        'in-addr.arpa': { Answer: [{ type: 12, data: 'cpanel168.dnscpanel.com.' }] },
      })
    );
    expect(await discoverServers('gestao@razao.pt')).toEqual({
      source: 'mx',
      oauth: null,
      servers: {
        imapHost: 'cpanel168.dnscpanel.com',
        imapPort: 993,
        smtpHost: 'cpanel168.dnscpanel.com',
        smtpPort: 465,
      },
    });
  });

  it('alojamento pelo MX e, sem nada, o palpite mail.<domínio>', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        'type=MX': { Answer: [{ type: 15, data: '10 mx1.sapo.pt.' }] },
        'v1.1/sapo.pt': XML,
      })
    );
    expect(await discoverServers('gestao@razao.pt')).toMatchObject({
      source: 'mx',
      servers: { imapHost: 'imap.sapo.pt' },
    });
    vi.stubGlobal('fetch', respond({}));
    expect(await discoverServers('gestao@razao.pt')).toMatchObject({
      source: 'guess',
      servers: { imapHost: 'mail.razao.pt', smtpPort: 465 },
    });
  });
});
