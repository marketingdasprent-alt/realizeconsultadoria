// Regras de validação do registo de ponto (partilhadas entre a edge function
// `clock-punch` e os testes Vitest). Sem dependências de Deno/Node.
//
// Filosofia antifraude:
//   * A validação do raio é SEMPRE feita no servidor (o cliente não decide).
//   * Sinais fortes (fora do raio, precisão fraca, posição antiga, tag
//     inválida) → rejeição.
//   * Sinais fracos (VPN, IP longe, coordenadas repetidas, viagem impossível,
//     dispositivo partilhado) → o registo entra como 'flagged' para revisão.
//     Não se bloqueia por defeito porque há falsos positivos legítimos
//     (ex.: iCloud Private Relay aparece como VPN; IPs móveis geolocalizam mal).

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PositionReading extends GeoPoint {
  accuracy: number;
  /** Idade da leitura GPS medida no próprio dispositivo (Date.now() - position.timestamp). */
  ageMs: number;
}

export interface LocationRules extends GeoPoint {
  radiusM: number;
  maxAccuracyM: number;
  blockVpn: boolean;
  trustedIps: string[];
}

export interface IpInfo {
  checked: boolean;
  country?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  isProxy?: boolean | null;
}

export interface PreviousPunch {
  lat: number | null;
  lng: number | null;
  punchedAtMs: number;
}

export type PunchMethod = 'nfc' | 'gps';

export interface PunchContext {
  method: PunchMethod;
  position: PositionReading;
  location: LocationRules;
  ip: string | null;
  ipInfo: IpInfo;
  previous: PreviousPunch | null;
  nowMs: number;
  repeatedCoordinates: boolean;
  deviceSeenBefore: boolean;
  deviceUsedByOthers: boolean;
}

export type RejectReason =
  | 'invalid_position'
  | 'stale_position'
  | 'low_accuracy'
  | 'out_of_radius'
  | 'vpn_blocked';

export interface PunchEvaluation {
  rejected: RejectReason | null;
  distanceM: number;
  flags: string[];
  status: 'valid' | 'flagged';
}

/** Flags que, presentes, colocam o registo em revisão ('flagged'). */
export const WARNING_FLAGS = new Set([
  'vpn_or_proxy',
  'ip_far_from_location',
  'suspicious_accuracy',
  'repeated_coordinates',
  'impossible_travel',
  'shared_device',
]);

export const MAX_POSITION_AGE_MS = 2 * 60 * 1000;
export const IP_FAR_THRESHOLD_KM = 400;
export const IMPOSSIBLE_SPEED_KMH = 250;
export const DUPLICATE_WINDOW_MS = 60 * 1000;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export const haversineMeters = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
};

/** true se o IP coincide com algum item (IP exato ou CIDR IPv4) da lista. */
export const ipMatchesAny = (ip: string | null, list: string[]): boolean => {
  if (!ip) return false;
  const normalized = ip.trim().toLowerCase();
  return list.some(raw => {
    const entry = raw.trim().toLowerCase();
    if (!entry) return false;
    if (!entry.includes('/')) return entry === normalized;
    const [base, bitsRaw] = entry.split('/');
    const bits = Number(bitsRaw);
    const ipInt = ipv4ToInt(normalized);
    const baseInt = ipv4ToInt(base);
    if (ipInt === null || baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) >>> 0 === (baseInt & mask) >>> 0;
  });
};

export const isValidPosition = (
  p: Partial<PositionReading> | null | undefined
): p is PositionReading =>
  !!p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Number.isFinite(p.accuracy) &&
  Number.isFinite(p.ageMs) &&
  Math.abs(p.lat as number) <= 90 &&
  Math.abs(p.lng as number) <= 180 &&
  (p.accuracy as number) >= 0;

/**
 * Avalia um registo de ponto. Pura: toda a informação externa (IP, histórico,
 * dispositivo) chega já resolvida em `ctx`.
 */
export const evaluatePunch = (ctx: PunchContext): PunchEvaluation => {
  const flags: string[] = [];
  const { position, location } = ctx;

  if (!isValidPosition(position)) {
    return { rejected: 'invalid_position', distanceM: NaN, flags, status: 'valid' };
  }

  const distanceM = haversineMeters(position, location);
  const reject = (reason: RejectReason): PunchEvaluation => ({
    rejected: reason,
    distanceM,
    flags,
    status: 'valid',
  });

  if (Math.abs(position.ageMs) > MAX_POSITION_AGE_MS) return reject('stale_position');
  if (position.accuracy > location.maxAccuracyM) return reject('low_accuracy');

  // Com tag NFC a presença física já está provada; tolera-se a incerteza do
  // GPS (o círculo de precisão tem de tocar no raio). Só GPS: estrito.
  const tolerance = ctx.method === 'nfc' ? position.accuracy : 0;
  if (distanceM - tolerance > location.radiusM) return reject('out_of_radius');

  const trusted = ipMatchesAny(ctx.ip, location.trustedIps);
  if (trusted) flags.push('trusted_network');

  if (!trusted && ctx.ipInfo.checked) {
    if (ctx.ipInfo.isProxy) {
      if (location.blockVpn) return reject('vpn_blocked');
      flags.push('vpn_or_proxy');
    }
    if (Number.isFinite(ctx.ipInfo.lat) && Number.isFinite(ctx.ipInfo.lng)) {
      const ipKm =
        haversineMeters(
          { lat: ctx.ipInfo.lat as number, lng: ctx.ipInfo.lng as number },
          location
        ) / 1000;
      if (ipKm > IP_FAR_THRESHOLD_KM) flags.push('ip_far_from_location');
    }
  }
  if (!trusted && !ctx.ipInfo.checked) flags.push('ip_check_unavailable');

  // Apps de "fake GPS" costumam reportar precisão 0–1 m e coordenadas fixas.
  if (position.accuracy < 2) flags.push('suspicious_accuracy');
  // Coordenadas exatamente iguais a um registo anterior só são normais em
  // posicionamento por Wi-Fi (precisão larga). Com precisão fina é suspeito.
  if (ctx.repeatedCoordinates && position.accuracy < 10) flags.push('repeated_coordinates');

  if (ctx.previous && ctx.previous.lat !== null && ctx.previous.lng !== null) {
    const km = haversineMeters({ lat: ctx.previous.lat, lng: ctx.previous.lng }, position) / 1000;
    const hours = (ctx.nowMs - ctx.previous.punchedAtMs) / 3_600_000;
    if (km > 2 && hours > 0 && km / hours > IMPOSSIBLE_SPEED_KMH) flags.push('impossible_travel');
  }

  if (!ctx.deviceSeenBefore) flags.push('new_device');
  if (ctx.deviceUsedByOthers) flags.push('shared_device');
  if (ctx.method === 'gps') flags.push('gps_only');

  const status = flags.some(f => WARNING_FLAGS.has(f)) ? 'flagged' : 'valid';
  return { rejected: null, distanceM, flags, status };
};

/** Próximo tipo de registo: 'out' se o último foi 'in' há menos de 16h. */
export const nextEntryType = (
  last: { entry_type: string; punchedAtMs: number } | null,
  nowMs: number
): 'in' | 'out' => {
  if (last && last.entry_type === 'in' && nowMs - last.punchedAtMs < 16 * 3_600_000) return 'out';
  return 'in';
};

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};
