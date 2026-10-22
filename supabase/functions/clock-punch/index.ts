// Registo de ponto do colaborador — jornada como no Bitrix24.
//
// POST { method: 'nfc' | 'gps', action: 'start' | 'pause' | 'resume' | 'stop',
//        tag?: { t } | { e, c }, position?: { lat, lng, accuracy, age_ms } | null,
//        device_id, note?: string, at?: ISO }
// (versões antigas da app enviam entry_type: 'in' | 'out' em vez de action.)
//
// Toda a validação é feita aqui (service role): identidade, tag NFC, distância
// ao local, precisão GPS, IP/VPN, dispositivo e anti-replay. O ponto regista-se
// sempre (decidePunch): fora dos locais ou sem GPS fica válido com o sítio gravado
// (a equipa trabalha em vários escritórios); só vai para revisão com sinais de fraude.
// Só se recusa tag inválida ou repetida, tag de outra empresa e VPN/Tor quando o
// local o bloqueia.
// `at` é a hora indicada pelo colaborador para um registo esquecido (✎): exige
// motivo e fica sempre a aguardar aprovação. Fora dos locais guarda-se a morada
// aproximada (OpenStreetMap) para mostrar onde a pessoa estava.
// A sequência (dia por iniciar → a trabalhar ⇄ em pausa → terminado, "Retomar
// dia"), os duplicados e o lock são decididos em time_clock_register_punch.
// Respostas de negócio vêm sempre com HTTP 200 e { ok: boolean, code }.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hexToBytes, verifySunMessage } from '../_shared/ntag424.ts';
import {
  WORKDAY_ACTIONS,
  applyManualTime,
  decidePunch,
  haversineMeters,
  ipMatchesAny,
  isValidPosition,
  parseManualTime,
  sha256Hex,
  shouldNotifyApprovers,
  type IpInfo,
  type LocationRules,
  type PositionReading,
} from '../_shared/timeclock-rules.ts';
import { saveEntryAddress } from './geocode.ts';
import { notifyApprovers } from './notify.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PunchRequest {
  method?: 'nfc' | 'gps';
  action?: string;
  tag?: { t?: string; e?: string; c?: string };
  position?: { lat?: number; lng?: number; accuracy?: number; age_ms?: number } | null;
  device_id?: string;
  /** Versões antigas da app: Entrada/Saída em vez de action. */
  entry_type?: 'in' | 'out';
  note?: string;
  /** Hora indicada pelo colaborador (registo esquecido); exige motivo em `note`. */
  at?: string;
}

interface LocationRow {
  id: string;
  company_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  max_accuracy_m: number;
  allow_manual: boolean;
  block_vpn: boolean;
  trusted_ips: string[];
  is_active: boolean;
}

interface ResolvedTag {
  id: string;
  counter: number | null;
  location: LocationRow;
}

interface EntryRow {
  id: string;
  entry_type: 'in' | 'out';
  kind: 'work' | 'break';
  punched_at: string;
  status: string;
  flags: string[];
  distance_m: number | null;
  address: string | null;
  source: string;
  work_mode: string;
  created_at: string;
}

interface RegisterResult {
  duplicate?: boolean;
  error?: 'invalid_state' | 'invalid_time';
  state?: 'closed' | 'working' | 'paused';
  entry?: EntryRow | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const LOCATION_COLUMNS =
  'id, company_id, name, latitude, longitude, radius_m, max_accuracy_m, allow_manual, block_vpn, trusted_ips, is_active';

const toRules = (l: LocationRow): LocationRules => ({
  lat: l.latitude,
  lng: l.longitude,
  radiusM: l.radius_m,
  maxAccuracyM: l.max_accuracy_m,
  blockVpn: l.block_vpn,
  trustedIps: l.trusted_ips ?? [],
});

const finiteOrNull = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || null;
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
};

/** Deteção de VPN/proxy + geolocalização do IP via proxycheck.io (timeout curto, nunca bloqueia). */
const lookupIp = async (ip: string | null): Promise<IpInfo> => {
  if (!ip) return { checked: false };
  const key = Deno.env.get('PROXYCHECK_API_KEY');
  const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1${key ? `&key=${key}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    const info = data?.[ip];
    if (data?.status === 'error' || data?.status === 'denied' || !info) {
      console.warn('clock-punch: proxycheck sem resposta útil', data?.status, data?.message);
      return { checked: false };
    }
    return {
      checked: true,
      country: info.isocode ?? null,
      city: info.city ?? null,
      lat: typeof info.latitude === 'number' ? info.latitude : null,
      lng: typeof info.longitude === 'number' ? info.longitude : null,
      isProxy: info.proxy === 'yes' || info.type === 'VPN' || info.type === 'Hosting',
      proxyType: typeof info.type === 'string' ? info.type : null,
    };
  } catch {
    return { checked: false };
  } finally {
    clearTimeout(timer);
  }
};

const resolveTag = async (
  db: SupabaseClient,
  tag: PunchRequest['tag']
): Promise<ResolvedTag | { error: string }> => {
  if (tag?.t && typeof tag.t === 'string' && tag.t.length <= 128) {
    const { data } = await db
      .from('time_clock_tags')
      .select(`id, is_active, location:time_clock_locations(${LOCATION_COLUMNS})`)
      .eq('tag_type', 'static')
      .eq('token_hash', await sha256Hex(tag.t))
      .maybeSingle();
    if (!data || !data.is_active || !data.location) return { error: 'invalid_tag' };
    return { id: data.id, counter: null, location: data.location as unknown as LocationRow };
  }

  if (tag?.e && tag?.c) {
    const metaKeyHex = Deno.env.get('NTAG424_SDM_KEY');
    if (!metaKeyHex) return { error: 'ntag424_not_configured' };
    const metaKey = hexToBytes(metaKeyHex);
    const fileKey = hexToBytes(Deno.env.get('NTAG424_SDM_FILE_KEY') ?? metaKeyHex);
    const sun = await verifySunMessage(tag.e, tag.c, metaKey, fileKey);
    if (!sun.valid || !sun.uid || sun.counter === undefined) return { error: 'invalid_tag' };

    const { data } = await db
      .from('time_clock_tags')
      .select(`id, is_active, last_counter, location:time_clock_locations(${LOCATION_COLUMNS})`)
      .eq('tag_type', 'ntag424')
      .eq('uid', sun.uid)
      .maybeSingle();
    if (!data || !data.is_active || !data.location) return { error: 'invalid_tag' };
    if (sun.counter <= data.last_counter) return { error: 'replayed_tag' };
    return { id: data.id, counter: sun.counter, location: data.location as unknown as LocationRow };
  }

  return { error: 'invalid_tag' };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, code: 'unauthorized' }, 401);
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace('Bearer ', '')
  );
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return json({ ok: false, code: 'unauthorized' }, 401);

  let body: PunchRequest;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  const method = body.method === 'nfc' ? 'nfc' : body.method === 'gps' ? 'gps' : null;
  if (!method) return json({ ok: false, code: 'bad_request' }, 400);
  const action = WORKDAY_ACTIONS.find(a => a === body.action) ?? null;
  if (body.action !== undefined && !action) return json({ ok: false, code: 'bad_request' }, 400);
  const entryType = body.entry_type === 'in' || body.entry_type === 'out' ? body.entry_type : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null;
  // Registo esquecido: hora indicada (até 12 h para trás), só com ação. Com motivo fica válido;
  // sem motivo os RH aprovam.
  const manualAt = parseManualTime(body.at, Date.now());
  if (manualAt === 'invalid') return json({ ok: false, code: 'invalid_time' });
  if (manualAt !== null && !action) return json({ ok: false, code: 'bad_request' }, 400);

  const { data: employee } = await db
    .from('employees')
    .select('id, name, company_id, is_active, companies(name)')
    .eq('user_id', userId)
    .maybeSingle();
  if (!employee) return json({ ok: false, code: 'not_employee' }, 403);
  if (!employee.is_active) return json({ ok: false, code: 'inactive_employee' }, 403);

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null;
  const deviceId = typeof body.device_id === 'string' ? body.device_id.slice(0, 100) : null;
  const position: Partial<PositionReading> = {
    lat: body.position?.lat,
    lng: body.position?.lng,
    accuracy: body.position?.accuracy,
    ageMs: body.position?.age_ms,
  };
  const hasPosition = isValidPosition(position);
  const latitude = hasPosition ? finiteOrNull(position.lat) : null;
  const longitude = hasPosition ? finiteOrNull(position.lng) : null;
  const accuracyM = hasPosition ? finiteOrNull(position.accuracy) : null;

  const logAttempt = async (
    reason: string,
    extra: {
      location_id?: string;
      tag_id?: string;
      distance_m?: number;
      flags?: string[];
      ip_country?: string | null;
    } = {}
  ) => {
    await db.from('time_clock_attempts').insert({
      employee_id: employee.id,
      user_id: userId,
      source: method,
      reason,
      flags: extra.flags ?? [],
      location_id: extra.location_id ?? null,
      tag_id: extra.tag_id ?? null,
      latitude,
      longitude,
      accuracy_m: accuracyM,
      distance_m: Number.isFinite(extra.distance_m) ? extra.distance_m : null,
      ip_address: ip,
      ip_country: extra.ip_country ?? null,
      device_id: deviceId,
      user_agent: userAgent,
    });
    return json({ ok: false, code: reason });
  };

  // 1. Locais da empresa (Wi-Fi do escritório, local mais próximo) e tag.
  const { data: locationRows } = await db
    .from('time_clock_locations')
    .select(LOCATION_COLUMNS)
    .eq('company_id', employee.company_id)
    .eq('is_active', true);
  const locations = (locationRows as LocationRow[] | null) ?? [];
  const networkLocation = locations.find(l => ipMatchesAny(ip, l.trusted_ips ?? [])) ?? null;

  let tag: ResolvedTag | null = null;
  let location: LocationRow | null = null;
  if (method === 'nfc') {
    const resolved = await resolveTag(db, body.tag);
    if ('error' in resolved) return logAttempt(resolved.error);
    tag = resolved;
    location = resolved.location;
    if (!location.is_active) return logAttempt('invalid_tag', { tag_id: tag.id });
    if (location.company_id !== employee.company_id) {
      return logAttempt('tag_other_company', { tag_id: tag.id, location_id: location.id });
    }
  } else if (hasPosition) {
    const here = { lat: position.lat, lng: position.lng };
    location = locations.reduce<LocationRow | null>(
      (best, l) =>
        !best ||
        haversineMeters(here, { lat: l.latitude, lng: l.longitude }) <
          haversineMeters(here, { lat: best.latitude, lng: best.longitude })
          ? l
          : best,
      null
    );
  } else {
    // Sem GPS não há "mais próximo": o local da rede do escritório ou um com
    // bloqueio de VPN (para a regra da VPN continuar a valer).
    location = networkLocation ?? locations.find(l => l.block_vpn) ?? null;
  }

  // Morada só quando não está claramente dentro do local mais próximo (poupa o OpenStreetMap).
  const insideNearest =
    !!location &&
    latitude !== null &&
    longitude !== null &&
    haversineMeters(
      { lat: latitude, lng: longitude },
      { lat: location.latitude, lng: location.longitude }
    ) <= location.radius_m &&
    (accuracyM ?? Infinity) <= location.max_accuracy_m;

  // 2. Contexto: IP, último registo, dispositivo, coordenadas repetidas.
  const since60d = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [ipInfo, lastRes, deviceSeenRes, deviceOthersRes, repeatedRes] = await Promise.all([
    lookupIp(ip),
    db
      .from('time_clock_entries')
      .select('punched_at, latitude, longitude')
      .eq('employee_id', employee.id)
      .neq('status', 'voided')
      .order('punched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    deviceId
      ? db
          .from('time_clock_entries')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employee.id)
          .eq('device_id', deviceId)
      : Promise.resolve({ count: 0 }),
    deviceId
      ? db
          .from('time_clock_entries')
          .select('id', { count: 'exact', head: true })
          .eq('device_id', deviceId)
          .neq('employee_id', employee.id)
          .gte('punched_at', since60d)
      : Promise.resolve({ count: 0 }),
    latitude !== null && longitude !== null
      ? db
          .from('time_clock_entries')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employee.id)
          .eq('latitude', latitude)
          .eq('longitude', longitude)
      : Promise.resolve({ count: 0 }),
  ]);

  // 3. Regras: regista sempre; fora dos locais ou sem GPS fica válido, com a morada.
  const now = Date.now();
  const last = lastRes.data;
  const decision = decidePunch({
    method,
    action,
    position,
    location: location ? toRules(location) : null,
    ip,
    ipInfo,
    trustedNetwork: !!networkLocation,
    manualNotAllowed: method === 'gps' && !!location && !location.allow_manual,
    previous: last
      ? {
          lat: last.latitude,
          lng: last.longitude,
          punchedAtMs: new Date(last.punched_at).getTime(),
        }
      : null,
    nowMs: now,
    repeatedCoordinates: (repeatedRes.count ?? 0) > 0,
    deviceSeenBefore: !deviceId || (deviceSeenRes.count ?? 0) > 0,
    deviceUsedByOthers: (deviceOthersRes.count ?? 0) > 0,
  });
  if (decision.rejected) {
    return logAttempt(decision.rejected, {
      location_id: location?.id,
      tag_id: tag?.id,
      distance_m: decision.distanceM,
      flags: decision.flags,
      ip_country: ipInfo.country,
    });
  }
  const officeLocation =
    decision.presence === 'network' ? networkLocation : decision.presence ? location : null;
  // Registo esquecido com hora indicada: com motivo fica válido; sem motivo os RH aprovam.
  const { status, flags } =
    manualAt !== null ? applyManualTime(decision, (note?.length ?? 0) >= 3) : decision;

  // 4. Anti-replay NTAG 424: só avança se o contador ainda for maior (evita corridas).
  if (tag) {
    let update = db
      .from('time_clock_tags')
      .update({
        last_used_at: new Date(now).toISOString(),
        ...(tag.counter !== null ? { last_counter: tag.counter } : {}),
      })
      .eq('id', tag.id);
    if (tag.counter !== null) update = update.lt('last_counter', tag.counter);
    const { data: updated } = await update.select('id');
    if (tag.counter !== null && !updated?.length) {
      return logAttempt('replayed_tag', { tag_id: tag.id });
    }
  }

  // 5. Gravar (sequência, duplicados e lock decididos na BD).
  const distanceM = Number.isFinite(decision.distanceM)
    ? Math.round(decision.distanceM * 10) / 10
    : null;
  const { data, error: rpcError } = await db.rpc('time_clock_register_punch', {
    _payload: {
      employee_id: employee.id,
      company_id: employee.company_id,
      ...(action ? { action } : { entry_type: entryType }),
      ...(manualAt !== null ? { punched_at: new Date(manualAt).toISOString() } : {}),
      location_id: officeLocation?.id ?? null,
      tag_id: tag?.id ?? null,
      source: method,
      status,
      flags,
      latitude,
      longitude,
      accuracy_m: accuracyM,
      distance_m: distanceM,
      address: null,
      ip_address: ip,
      ip_country: ipInfo.country ?? null,
      ip_city: ipInfo.city ?? null,
      ip_is_proxy: ipInfo.checked ? !!ipInfo.isProxy : null,
      device_id: deviceId,
      user_agent: userAgent,
      work_mode: officeLocation ? 'office' : 'remote',
      employee_note: note || null,
      user_id: userId,
    },
  });
  const result = data as RegisterResult | null;

  if (rpcError || !result) {
    console.error('clock-punch register error:', rpcError);
    return json({ ok: false, code: 'server_error' }, 500);
  }

  const locationName = officeLocation?.name ?? 'Fora do local de trabalho';
  const toResponse = (entry: EntryRow) => ({
    id: entry.id,
    entry_type: entry.entry_type,
    kind: entry.kind ?? 'work',
    punched_at: entry.punched_at,
    status: entry.status,
    flags: entry.flags,
    distance_m: entry.distance_m,
    address: entry.address ?? null,
    source: entry.source,
    work_mode: entry.work_mode,
    created_at: entry.created_at,
    location_name: locationName,
  });

  // O ecrã estava desatualizado (ex.: dia terminado noutro telemóvel) ou a hora
  // indicada não é depois do último registo.
  if (result.error) {
    return json({
      ok: false,
      code: result.error,
      state: result.state,
      entry: result.entry ? toResponse(result.entry) : null,
    });
  }
  if (!result.entry) {
    console.error('clock-punch register: resposta sem registo', result);
    return json({ ok: false, code: 'server_error' }, 500);
  }

  const entry = result.entry;
  if (result.duplicate) {
    return json({ ok: true, code: 'duplicate', state: result.state, entry: toResponse(entry) });
  }

  // 6. Morada aproximada (OpenStreetMap), em segundo plano: o registo não espera.
  if (method === 'gps' && latitude !== null && longitude !== null && !insideNearest) {
    const task = saveEntryAddress(db, entry.id, latitude, longitude);
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(task);
    else await task;
  }

  // 7. Email aos admins só com sinais suspeitos ou correção de hora; fora do local fica
  //    só na Revisão (sem atrasar a resposta).
  if (shouldNotifyApprovers(entry.status, entry.flags)) {
    const company = employee.companies as unknown as { name: string } | null;
    const task = notifyApprovers(db, {
      employeeName: employee.name,
      companyName: company?.name ?? null,
      entryType: entry.entry_type,
      kind: entry.kind ?? 'work',
      punchedAt: entry.punched_at,
      status: entry.status,
      workMode: entry.work_mode,
      latitude,
      longitude,
      accuracyM,
      distanceM,
      locationName: location?.name ?? null,
      address: entry.address ?? null,
      recordedAt: entry.created_at,
      flags: entry.flags,
      note: note || null,
    });
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(task);
    else await task;
  }

  return json({
    ok: true,
    code: entry.status === 'pending' ? 'pending_approval' : 'registered',
    state: result.state,
    entry: toResponse(entry),
    // Para explicar porque ficou a aguardar aprovação ("a 10,3 km de Premium Ride").
    distance_m: distanceM,
    location_name: location?.name ?? null,
  });
});
