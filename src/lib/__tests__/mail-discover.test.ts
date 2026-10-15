import { describe, expect, it } from 'vitest';
import {
  discoverDomain,
  parseIspdbXml,
  type DiscoveryResolver,
} from '../../../supabase/functions/_shared/mail/discover';

const XML = `<clientConfig><emailProvider id="sapo.pt">
<incomingServer type="imap"><hostname>imap.sapo.pt</hostname><port>143</port><socketType>STARTTLS</socketType></incomingServer>
<incomingServer type="imap"><hostname>imap.sapo.pt</hostname><port>993</port><socketType>SSL</socketType></incomingServer>
<outgoingServer type="smtp"><hostname>smtp.sapo.pt</hostname><port>587</port><socketType>STARTTLS</socketType></outgoingServer>
<outgoingServer type="smtp"><hostname>smtp.sapo.pt</hostname><port>465</port><socketType>SSL</socketType></outgoingServer>
</emailProvider></clientConfig>`;

const resolver = (over: Partial<DiscoveryResolver> = {}): DiscoveryResolver => ({
  mx: async () => [],
  a: async () => [],
  ptr: async () => [],
  ispdb: async () => null,
  ...over,
});

describe('descoberta de servidores (edge function)', () => {
  it('lê o XML do ISPDB sem DOMParser e prefere SSL', () => {
    expect(parseIspdbXml(XML)).toEqual({
      imapHost: 'imap.sapo.pt',
      imapPort: 993,
      smtpHost: 'smtp.sapo.pt',
      smtpPort: 465,
    });
    expect(parseIspdbXml('<clientConfig/>')).toBeNull();
  });

  it('Microsoft 365 e Google Workspace pelo MX', async () => {
    const ms = resolver({ mx: async () => ['dasprent-pt.mail.protection.outlook.com'] });
    expect(await discoverDomain('dasprent.pt', ms)).toMatchObject({ oauth: 'office365' });
    const google = resolver({ mx: async () => ['aspmx.l.google.com.'] });
    expect(await discoverDomain('empresa.pt', google)).toMatchObject({ oauth: 'gmail' });
  });

  it('cPanel: do MX ao nome real do servidor', async () => {
    const r = resolver({
      mx: async () => ['_dc-mx.88063ec0f1b1.razaodinamica.pt'],
      a: async () => ['185.12.116.27'],
      ptr: async ip => (ip === '185.12.116.27' ? ['cpanel168.dnscpanel.com.'] : []),
    });
    expect(await discoverDomain('razaodinamica.pt', r)).toEqual({
      oauth: null,
      source: 'mx',
      servers: {
        imapHost: 'cpanel168.dnscpanel.com',
        imapPort: 993,
        smtpHost: 'cpanel168.dnscpanel.com',
        smtpPort: 465,
      },
    });
  });

  it('falhas de DNS não rebentam: fica o palpite', async () => {
    const r = resolver({
      mx: async () => {
        throw new Error('dns');
      },
      ispdb: async () => {
        throw new Error('rede');
      },
    });
    expect(await discoverDomain('razao.pt', r)).toMatchObject({
      source: 'guess',
      servers: { imapHost: 'mail.razao.pt' },
    });
    expect(await discoverDomain('não é domínio', r)).toBeNull();
  });
});
