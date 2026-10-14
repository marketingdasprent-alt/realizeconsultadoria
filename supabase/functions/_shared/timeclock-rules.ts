// Regras de validação do registo de ponto (partilhadas entre a edge function
// `clock-punch` e os testes Vitest). Sem dependências de Deno/Node.
//
// Filosofia (como o Bitrix24): o ponto regista-se SEMPRE e revê-se depois.
//   * A validação do raio é feita no servidor (o cliente não decide).
//   * Presença comprovada (GPS dentro do raio, tag NFC ou Wi-Fi do escritório)
//     → válido. Fora dos locais, sem GPS ou com GPS fraco → registado na mesma,
//     a aguardar aprovação, com o motivo nas flags (decidePunch).
//   * Sinais fracos (VPN, IP longe, coordenadas repetidas, viagem impossível,
//     dispositivo partilhado) → o registo entra como 'flagged' para revisão.
//   * Só se recusa o que é fraude evidente: tag inválida/repetida, tag de outra
//     empresa e VPN/Tor quando o local o bloqueia.

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
  /** Tipo devolvido pelo proxycheck ('VPN', 'TOR', 'SOCKS5', 'Hosting', ...). */
  proxyType?: string | null;
}

/**
 * Só estes tipos contam como VPN a sério. Os IPs dos operadores móveis são
 * partilhados por milhares de clientes (CGNAT) e aparecem muitas vezes como
 * "SOCKS5/HTTP" por causa de apps de proxy instaladas por outra pessoa; bloquear
 * por isso recusava gente dentro do escritório.
 */
export const ANONYMIZER_TYPES = new Set(['VPN', 'TOR']);

export const isAnonymizer = (info: IpInfo): boolean =>
  !!info.isProxy && ANONYMIZER_TYPES.has((info.proxyType ?? '').toUpperCase());

export interface PreviousPunch {
  lat: number | null;
  lng: number | null;
  punchedAtMs: number;
}

export type PunchMethod = 'nfc' | 'gps';

/** 'office' = dentro de um local (validado); 'remote' = fora, aguarda aprovação. */
export type PunchMode = 'office' | 'remote';

export interface PunchContext {
  method: PunchMethod;
  /** Por omissão 'office'. */
  mode?: PunchMode;
  position: PositionReading;
  /** Local mais próximo / da tag. Em 'remote' pode não existir (empresa sem locais). */
  location: LocationRules | null;
  ip: string | null;
  ipInfo: IpInfo;
  /**
   * IP na rede de confiança de algum local da empresa. Se omitido, vê-se só a
   * lista do próprio local.
   */
  trustedNetwork?: boolean;
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
  | 'approximate_location'
  | 'out_of_radius'
  | 'no_location'
  | 'vpn_blocked';

export interface PunchEvaluation {
  rejected: RejectReason | null;
  distanceM: number;
  flags: string[];
  status: 'valid' | 'flagged' | 'pending';
}

/**
 * Recusas que o colaborador pode transformar num registo remoto (home office /
 * serviço externo), que fica a aguardar aprovação de um admin.
 */
export const REMOTE_ELIGIBLE_REASONS = new Set([
  'out_of_radius',
  'low_accuracy',
  'approximate_location',
  'no_location',
  'manual_not_allowed',
]);

/** Flags que, presentes, colocam o registo em revisão ('flagged'). */
export const WARNING_FLAGS = new Set([
  'vpn_or_proxy',
  'no_gps',
  'stale_gps',
  'imprecise_gps',
  'ip_far_from_location',
  'suspicious_accuracy',
  'repeated_coordinates',
  'impossible_travel',
  'shared_device',
]);

export const MAX_POSITION_AGE_MS = 2 * 60 * 1000;
/**
 * Precisão a partir da qual a leitura é "localização aproximada" (iPhone sem
 * "Localização exata", Android com localização aproximada): erra quilómetros.
 */
export const APPROXIMATE_LOCATION_M = 1000;
/** Uma entrada aberta há mais do que isto já não é fechada pela picagem seguinte. */
export const MAX_OPEN_SHIFT_HOURS = 12;
export const IP_FAR_THRESHOLD_KM = 400;
/** País da empresa: IPs daqui nunca dão o alerta "IP noutro país". */
export const HOME_COUNTRY = 'PT';
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
  const mode = ctx.mode ?? 'office';

  if (!isValidPosition(position)) {
    return { rejected: 'invalid_position', distanceM: NaN, flags, status: 'valid' };
  }

  const distanceM = location ? haversineMeters(position, location) : NaN;
  const reject = (reason: RejectReason): PunchEvaluation => ({
    rejected: reason,
    distanceM,
    flags,
    status: 'valid',
  });

  if (Math.abs(position.ageMs) > MAX_POSITION_AGE_MS) return reject('stale_position');

  if (mode === 'office') {
    if (!location) return reject('no_location');
    if (ctx.method === 'nfc') {
      // A tag prova a presença física. Com GPS impreciso (dentro de edifícios ou
      // localização aproximada) não se recusa: fica registado para os RH reverem.
      if (position.accuracy > location.maxAccuracyM) {
        flags.push('imprecise_gps');
      } else if (distanceM - position.accuracy > location.radiusM) {
        // GPS bom: o círculo de precisão tem de tocar no raio.
        return reject('out_of_radius');
      }
    } else {
      // Só GPS: estrito.
      if (position.accuracy >= APPROXIMATE_LOCATION_M) return reject('approximate_location');
      if (position.accuracy > location.maxAccuracyM) return reject('low_accuracy');
      if (distanceM > location.radiusM) return reject('out_of_radius');
    }
  } else {
    flags.push('remote');
  }

  const trusted = ctx.trustedNetwork ?? (!!location && ipMatchesAny(ctx.ip, location.trustedIps));
  if (trusted) flags.push('trusted_network');

  if (!trusted && ctx.ipInfo.checked) {
    if (isAnonymizer(ctx.ipInfo)) {
      if (location?.blockVpn) return reject('vpn_blocked');
      flags.push('vpn_or_proxy');
    } else if (ctx.ipInfo.isProxy) {
      // Informativo: IP partilhado marcado como proxy, sem revisão nem bloqueio.
      flags.push('shared_ip_proxy');
    }
    // IP de outro país e longe da posição GPS (ex.: VPN não detetada). Em Portugal a
    // localização do IP de dados móveis é pouco fiável (já apareceu nos Açores com a
    // pessoa no escritório), por isso IPs portugueses não dão este alerta.
    const foreignIp = !!ctx.ipInfo.country && ctx.ipInfo.country.toUpperCase() !== HOME_COUNTRY;
    if (foreignIp && Number.isFinite(ctx.ipInfo.lat) && Number.isFinite(ctx.ipInfo.lng)) {
      const ipKm =
        haversineMeters(
          { lat: ctx.ipInfo.lat as number, lng: ctx.ipInfo.lng as number },
          position
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

  const status =
    mode === 'remote' ? 'pending' : flags.some(f => WARNING_FLAGS.has(f)) ? 'flagged' : 'valid';
  return { rejected: null, distanceM, flags, status };
};

/** Ações da jornada (como o Bitrix24): Iniciar dia, Pausa, Retomar, Terminar dia. */
export type WorkdayAction = 'start' | 'pause' | 'resume' | 'stop';

export const WORKDAY_ACTIONS: readonly WorkdayAction[] = ['start', 'pause', 'resume', 'stop'];

/** Motivo (flag) por que o registo não ficou validado num local de trabalho. */
const NOT_VALIDATED_FLAG: Record<string, string> = {
  out_of_radius: 'outside_location',
  low_accuracy: 'weak_gps',
  approximate_location: 'approximate_location',
  no_location: 'no_location_configured',
  manual_not_allowed: 'tag_required',
};

/** Sem GPS: não é motivo de revisão quando a presença está comprovada por outra via. */
const NO_GPS_FLAGS = ['no_gps', 'stale_gps'];

/**
 * Como ficou comprovada a presença: GPS dentro do raio (ou tag com GPS a
 * confirmar), só a tag, Wi-Fi do escritório, ou não comprovada (null).
 */
export type Presence = 'location' | 'tag' | 'network' | null;

export interface PunchDecision {
  rejected: 'vpn_blocked' | null;
  status: 'valid' | 'flagged' | 'pending';
  flags: string[];
  distanceM: number;
  presence: Presence;
}

export interface DecideContext extends Omit<PunchContext, 'position' | 'mode' | 'trustedNetwork'> {
  /** null = app antiga (Entrada/Saída), tratada como início/fim. */
  action: WorkdayAction | null;
  /** Leitura GPS (pode faltar: GPS desligado, permissão negada, PC sem GPS). */
  position: Partial<PositionReading> | null;
  /** O local exige a tag (registo manual não permitido). */
  manualNotAllowed: boolean;
  /** O IP pertence à rede de confiança de um local (Wi-Fi do escritório). */
  trustedNetwork: boolean;
}

const hasWarnings = (flags: string[], ignore: string[] = []) =>
  flags.some(f => WARNING_FLAGS.has(f) && !ignore.includes(f));

const blocked = (flags: string[], distanceM: number): PunchDecision => ({
  rejected: 'vpn_blocked',
  status: 'valid',
  flags,
  distanceM,
  presence: null,
});

/** Presença não comprovada pelo GPS: decide pela rede, pela tag ou pela ação. */
const notValidated = (
  ctx: DecideContext,
  flags: string[],
  distanceM: number,
  tagPresence: boolean
): PunchDecision => {
  const review = hasWarnings(flags, NO_GPS_FLAGS) ? 'flagged' : 'valid';
  const decision = (status: PunchDecision['status'], presence: Presence): PunchDecision => ({
    rejected: null,
    status,
    flags,
    distanceM,
    presence,
  });
  // Wi-Fi do escritório comprova a presença (exceto onde o local exige a tag).
  if (ctx.trustedNetwork && !ctx.manualNotAllowed) return decision(review, 'network');
  // Parar o relógio não acrescenta horas: a pausa nunca precisa de aprovação.
  if (ctx.action === 'pause') return decision(review, tagPresence ? 'tag' : null);
  // A tag prova a presença; sem GPS para a confirmar, os RH revêem.
  if (tagPresence) return decision('flagged', 'tag');
  flags.push('remote');
  return decision('pending', null);
};

/**
 * Decide como registar. Como no Bitrix24, o ponto nunca falha por GPS ou distância:
 *  - presença comprovada (GPS dentro do raio, tag ou Wi-Fi do escritório) →
 *    válido, ou em revisão se houver alertas;
 *  - fora dos locais ou sem GPS → registado na mesma, a aguardar aprovação, com o
 *    motivo nas flags (a pausa fica logo válida);
 *  - só recusa VPN/Tor quando o local o bloqueia.
 */
export const decidePunch = (ctx: DecideContext): PunchDecision => {
  const { position } = ctx;
  const validPosition = isValidPosition(position);

  if (validPosition && Math.abs(position.ageMs) <= MAX_POSITION_AGE_MS) {
    const base = { ...ctx, position };
    const office = evaluatePunch({ ...base, mode: 'office' });
    if (office.rejected === 'vpn_blocked') return blocked(office.flags, office.distanceM);
    const reason = office.rejected ?? (ctx.manualNotAllowed ? 'manual_not_allowed' : null);
    if (!reason) {
      return {
        rejected: null,
        status: office.status,
        flags: office.flags,
        distanceM: office.distanceM,
        presence: 'location',
      };
    }
    // Fora do raio (ou sem local/GPS fraco): avalia como remoto para recolher os alertas.
    const remote = evaluatePunch({ ...base, mode: 'remote' });
    const flags = remote.flags.filter(f => f !== 'remote');
    if (remote.rejected === 'vpn_blocked') return blocked(flags, remote.distanceM);
    flags.push(NOT_VALIDATED_FLAG[reason] ?? 'outside_location');
    return notValidated(ctx, flags, remote.distanceM, false);
  }

  // Sem GPS (ou leitura antiga): avaliam-se só a rede, a VPN e o dispositivo.
  const flags = [validPosition ? 'stale_gps' : 'no_gps'];
  if (ctx.trustedNetwork) {
    flags.push('trusted_network');
  } else if (ctx.ipInfo.checked) {
    if (isAnonymizer(ctx.ipInfo)) {
      if (ctx.location?.blockVpn) return blocked(flags, NaN);
      flags.push('vpn_or_proxy');
    } else if (ctx.ipInfo.isProxy) {
      flags.push('shared_ip_proxy');
    }
  } else {
    flags.push('ip_check_unavailable');
  }
  if (!ctx.deviceSeenBefore) flags.push('new_device');
  if (ctx.deviceUsedByOthers) flags.push('shared_device');
  if (ctx.method === 'gps') flags.push('gps_only');
  return notValidated(ctx, flags, NaN, ctx.method === 'nfc');
};

/**
 * Próximo tipo esperado: 'out' se o último foi 'in' há menos de 12 h.
 * Só para mostrar ao colaborador — quem decide é a BD (time_clock_register_punch).
 */
export const nextEntryType = (
  last: { entry_type: string; punchedAtMs: number } | null,
  nowMs: number
): 'in' | 'out' => {
  if (
    last &&
    last.entry_type === 'in' &&
    nowMs - last.punchedAtMs < MAX_OPEN_SHIFT_HOURS * 3_600_000
  ) {
    return 'out';
  }
  return 'in';
};

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};
