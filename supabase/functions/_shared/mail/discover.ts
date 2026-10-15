// Descoberta dos servidores de email de um domínio (sem dependências de Deno: o DNS e o
// ISPDB entram como funções, para se poder testar). Ordem: fornecedores conhecidos →
// MX do Google/Microsoft (melhor OAuth) → ISPDB do Thunderbird → ISPDB do alojamento do
// MX → nome real do servidor do MX (DNS inverso, típico de cPanel/Plesk) → mail.<domínio>.

export interface DiscoveredServers {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export interface ServerDiscovery {
  servers: DiscoveredServers | null;
  /** O domínio usa Google/Microsoft: ligar por OAuth. */
  oauth: 'gmail' | 'office365' | null;
  source: 'known' | 'ispdb' | 'mx' | 'guess';
}

export interface DiscoveryResolver {
  mx: (domain: string) => Promise<string[]>;
  a: (host: string) => Promise<string[]>;
  ptr: (ip: string) => Promise<string[]>;
  /** XML do ISPDB (autoconfig.thunderbird.net) ou null. */
  ispdb: (domain: string) => Promise<string | null>;
}

const GOOGLE = ['gmail.com', 'googlemail.com'];
const MICROSOFT = [
  'outlook.com',
  'outlook.pt',
  'hotmail.com',
  'hotmail.pt',
  'live.com',
  'live.com.pt',
  'msn.com',
];

const ssl = (host: string): DiscoveredServers => ({
  imapHost: host,
  imapPort: 993,
  smtpHost: host,
  smtpPort: 465,
});

const KNOWN: Record<string, DiscoveredServers> = {
  'icloud.com': { ...ssl('imap.mail.me.com'), smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
  'me.com': { ...ssl('imap.mail.me.com'), smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
  'yahoo.com': { ...ssl('imap.mail.yahoo.com'), smtpHost: 'smtp.mail.yahoo.com' },
  'aol.com': { ...ssl('imap.aol.com'), smtpHost: 'smtp.aol.com' },
  'sapo.pt': { ...ssl('imap.sapo.pt'), smtpHost: 'smtp.sapo.pt' },
};

export const domainOfEmail = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

export const isDomain = (domain: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain);

const cleanHost = (host: string) => host.trim().replace(/\.$/, '').toLowerCase();

/** "mx1.ptisp.pt." → "ptisp.pt". */
export const baseDomain = (host: string) => {
  const parts = cleanHost(host).split('.');
  const twoLevel = parts.length > 2 && /^(com|co|org|net|gov|edu)$/.test(parts[parts.length - 2]);
  return parts.slice(twoLevel ? -3 : -2).join('.');
};

/** XML "clientConfig" do ISPDB → IMAP + SMTP, preferindo SSL (993/465). Sem DOMParser. */
export const parseIspdbXml = (xml: string): DiscoveredServers | null => {
  const blocks = (tag: string, type: string) =>
    [...xml.matchAll(new RegExp(`<${tag}[^>]*type="${type}"[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(
      m => m[1]
    );
  const field = (block: string, name: string) =>
    block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ?? '';
  const isSsl = (block: string) => field(block, 'socketType') === 'SSL';
  const imaps = blocks('incomingServer', 'imap');
  const smtps = blocks('outgoingServer', 'smtp');
  const imap = imaps.find(isSsl) ?? imaps[0];
  const smtp = smtps.find(b => isSsl(b) && field(b, 'port') === '465') ?? smtps[0];
  if (!imap || !smtp || !field(imap, 'hostname') || !field(smtp, 'hostname')) return null;
  return {
    imapHost: field(imap, 'hostname'),
    imapPort: Number(field(imap, 'port')) || 993,
    smtpHost: field(smtp, 'hostname'),
    smtpPort: Number(field(smtp, 'port')) || 465,
  };
};

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

const fromIspdb = async (domain: string, r: DiscoveryResolver) => {
  const xml = await safe(r.ispdb(domain), null);
  return xml ? parseIspdbXml(xml) : null;
};

/** Nome do servidor por trás de um MX (ex.: _dc-mx.x.dominio.pt → cpanel168.dnscpanel.com). */
const serverName = async (mxHost: string, r: DiscoveryResolver) => {
  const [ip] = (await safe(r.a(mxHost), [])).filter(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  if (!ip) return null;
  const [ptr] = await safe(r.ptr(ip), []);
  const host = ptr ? cleanHost(ptr) : '';
  // Nomes genéricos de IP (ex.: 27-116-12-185.static.isp.pt) não servem.
  return host && !/(\d+[-.]){3}\d+|static|dynamic|dsl|pool/.test(host) ? host : null;
};

export const discoverDomain = async (
  domain: string,
  r: DiscoveryResolver
): Promise<ServerDiscovery | null> => {
  if (!isDomain(domain)) return null;
  if (GOOGLE.includes(domain)) return { servers: null, oauth: 'gmail', source: 'known' };
  if (MICROSOFT.includes(domain)) return { servers: null, oauth: 'office365', source: 'known' };
  if (KNOWN[domain]) return { servers: KNOWN[domain], oauth: null, source: 'known' };

  const [ispdb, mxRaw] = await Promise.all([fromIspdb(domain, r), safe(r.mx(domain), [])]);
  const mx = mxRaw.map(cleanHost).filter(Boolean);
  if (mx.some(h => /(^|\.)(google\.com|googlemail\.com)$/.test(h)))
    return { servers: null, oauth: 'gmail', source: 'mx' };
  if (mx.some(h => /\.protection\.outlook\.com$/.test(h)))
    return { servers: null, oauth: 'office365', source: 'mx' };
  if (ispdb) return { servers: ispdb, oauth: null, source: 'ispdb' };

  for (const host of [...new Set(mx.map(baseDomain))].filter(h => h !== domain)) {
    const servers = await fromIspdb(host, r);
    if (servers) return { servers, oauth: null, source: 'mx' };
  }
  if (mx[0]) {
    const server = await serverName(mx[0], r);
    if (server) return { servers: ssl(server), oauth: null, source: 'mx' };
  }
  return { servers: ssl(`mail.${domain}`), oauth: null, source: 'guess' };
};
