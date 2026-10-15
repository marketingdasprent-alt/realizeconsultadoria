// Descoberta automática dos servidores de email a partir do endereço: fornecedores
// conhecidos, base de dados do Thunderbird (ISPDB) e o registo MX do domínio.
// Só sai o domínio (nunca o endereço completo nem a palavra-passe).
import type { MailProviderKey } from './providers';

export interface DiscoveredServers {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export interface Discovery {
  /** Servidores IMAP/SMTP encontrados (ou um palpite). */
  servers: DiscoveredServers | null;
  /** O domínio usa Google/Microsoft: melhor ligar por OAuth. */
  oauth: Extract<MailProviderKey, 'gmail' | 'office365'> | null;
  source: 'known' | 'ispdb' | 'mx' | 'guess';
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
const KNOWN: Record<string, DiscoveredServers> = {
  'icloud.com': {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
  },
  'me.com': {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
  },
  'yahoo.com': {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
  },
  'aol.com': { imapHost: 'imap.aol.com', imapPort: 993, smtpHost: 'smtp.aol.com', smtpPort: 465 },
  'sapo.pt': { imapHost: 'imap.sapo.pt', imapPort: 993, smtpHost: 'smtp.sapo.pt', smtpPort: 465 },
};

export const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';

/** XML do ISPDB (formato "clientConfig" do Thunderbird) → servidores IMAP + SMTP com SSL. */
export const parseIspdb = (xml: string): DiscoveredServers | null => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const pick = (selector: string, prefer: (el: Element) => boolean) => {
    const all = Array.from(doc.querySelectorAll(selector));
    return all.find(prefer) ?? all[0] ?? null;
  };
  const text = (el: Element | null, tag: string) =>
    el?.querySelector(tag)?.textContent?.trim() ?? '';
  const ssl = (el: Element) => text(el, 'socketType') === 'SSL';
  const imap = pick('incomingServer[type="imap"]', ssl);
  const smtp = pick('outgoingServer[type="smtp"]', el => ssl(el) && text(el, 'port') === '465');
  if (!imap || !smtp) return null;
  return {
    imapHost: text(imap, 'hostname'),
    imapPort: Number(text(imap, 'port')) || 993,
    smtpHost: text(smtp, 'hostname'),
    smtpPort: Number(text(smtp, 'port')) || 465,
  };
};

/** "mx1.ptisp.pt." → "ptisp.pt" (para procurar o alojamento no ISPDB). */
export const baseDomain = (host: string) => {
  const parts = host.replace(/\.$/, '').toLowerCase().split('.');
  const twoLevel = parts.length > 2 && /^(com|co|org|net|gov|edu)$/.test(parts[parts.length - 2]);
  return parts.slice(twoLevel ? -3 : -2).join('.');
};

/** Cada consulta à rede desiste ao fim de 4 s (a descoberta nunca fica pendurada). */
const TIMEOUT_MS = 4000;
const get = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

const ispdb = async (domain: string) => {
  try {
    const res = await get(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`);
    return res.ok ? parseIspdb(await res.text()) : null;
  } catch {
    return null;
  }
};

/** DNS por HTTPS (Cloudflare e, se falhar, Google); devolve os campos "data". */
const dns = async (name: string, type: 'MX' | 'A' | 'PTR'): Promise<string[]> => {
  const query = `name=${encodeURIComponent(name)}&type=${type}`;
  for (const url of [
    `https://cloudflare-dns.com/dns-query?${query}`,
    `https://dns.google/resolve?${query}`,
  ]) {
    try {
      const res = await get(url, { headers: { accept: 'application/dns-json' } });
      const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
      return (json.Answer ?? []).map(a => a.data);
    } catch {
      // tenta o seguinte
    }
  }
  return [];
};

const clean = (host: string) => host.replace(/\.$/, '').toLowerCase();

/** Nome real do servidor de um MX (DNS inverso do IP), ex.: cpanel168.dnscpanel.com. */
const serverName = async (mxHost: string) => {
  const [ip] = (await dns(mxHost, 'A')).filter(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  if (!ip) return null;
  const [ptr] = await dns(`${ip.split('.').reverse().join('.')}.in-addr.arpa`, 'PTR');
  const host = ptr ? clean(ptr) : '';
  // Nomes genéricos de IP (ex.: 27-116-12-185.static.isp.pt) não servem.
  return host && !/(\d+[-.]){3}\d+|static|dynamic|dsl|pool/.test(host) ? host : null;
};

const ssl = (host: string): DiscoveredServers => ({
  imapHost: host,
  imapPort: 993,
  smtpHost: host,
  smtpPort: 465,
});

export const discoverServers = async (email: string): Promise<Discovery | null> => {
  const domain = domainOf(email);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  if (GOOGLE.includes(domain)) return { servers: null, oauth: 'gmail', source: 'known' };
  if (MICROSOFT.includes(domain)) return { servers: null, oauth: 'office365', source: 'known' };
  if (KNOWN[domain]) return { servers: KNOWN[domain], oauth: null, source: 'known' };

  const [fromIspdb, mxData] = await Promise.all([ispdb(domain), dns(domain, 'MX')]);
  const mx = mxData.map(data => clean(data.split(' ').pop() ?? '')).filter(Boolean);
  if (mx.some(h => /(google\.com|googlemail\.com)$/.test(h)))
    return { servers: null, oauth: 'gmail', source: 'mx' };
  if (mx.some(h => /protection\.outlook\.com$/.test(h)))
    return { servers: null, oauth: 'office365', source: 'mx' };
  if (fromIspdb) return { servers: fromIspdb, oauth: null, source: 'ispdb' };

  // Alojamento conhecido pelo MX (ex.: mx1.sapo.pt → ISPDB de sapo.pt).
  for (const host of [...new Set(mx.map(baseDomain))].filter(h => h !== domain)) {
    const servers = await ispdb(host);
    if (servers) return { servers, oauth: null, source: 'mx' };
  }
  // Alojamento partilhado (cPanel, Plesk…): o nome do servidor tem certificado válido,
  // ao contrário de mail.<domínio>, que muitas vezes passa pelo Cloudflare.
  if (mx[0]) {
    const server = await serverName(mx[0]);
    if (server) return { servers: ssl(server), oauth: null, source: 'mx' };
  }
  return { servers: ssl(`mail.${domain}`), oauth: null, source: 'guess' };
};
