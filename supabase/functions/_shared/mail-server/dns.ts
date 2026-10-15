// Resolvedor para a descoberta de servidores: DNS nativo do Deno e, se não estiver
// disponível no runtime, DNS por HTTPS (Cloudflare). Cada consulta desiste ao fim de 4 s.
import type { DiscoveryResolver } from '../mail/discover.ts';
import { fetchWithTimeout } from './http.ts';

const TIMEOUT_MS = 4000;

type RecordKind = 'MX' | 'A' | 'PTR' | 'TXT';

const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);

const doh = async (name: string, type: RecordKind): Promise<string[]> => {
  const res = await fetchWithTimeout(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } },
    TIMEOUT_MS
  );
  const json = (await res.json()) as { Answer?: { data: string }[] };
  return (json.Answer ?? []).map(a =>
    type === 'MX'
      ? (a.data.split(' ').pop() ?? '')
      : type === 'TXT'
        ? a.data.replace(/"\s*"/g, '').replace(/^"|"$/g, '')
        : a.data
  );
};

const native = async (name: string, type: RecordKind): Promise<string[]> => {
  if (type === 'MX') {
    const records = await withTimeout(Deno.resolveDns(name, 'MX'));
    return records.sort((a, b) => a.preference - b.preference).map(r => r.exchange);
  }
  if (type === 'TXT') {
    const records = await withTimeout(Deno.resolveDns(name, 'TXT'));
    return records.map(chunks => chunks.join(''));
  }
  return withTimeout(Deno.resolveDns(name, type));
};

const lookup = async (name: string, type: RecordKind) => {
  try {
    return await native(name, type);
  } catch {
    return doh(name, type).catch(() => []);
  }
};

export const denoResolver: DiscoveryResolver = {
  mx: domain => lookup(domain, 'MX'),
  a: host => lookup(host, 'A'),
  txt: domain => lookup(domain, 'TXT'),
  ptr: ip => lookup(`${ip.split('.').reverse().join('.')}.in-addr.arpa`, 'PTR'),
  ispdb: async domain => {
    const res = await fetchWithTimeout(
      `https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`,
      {},
      TIMEOUT_MS
    );
    return res.ok ? res.text() : null;
  },
};
