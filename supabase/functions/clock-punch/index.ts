// Registo de ponto do colaborador.
//
// POST { method: 'nfc' | 'gps', tag?: { t } | { e, c }, position, device_id, entry_type? }
//
// Toda a validação é feita aqui (service role): identidade, tag NFC,
// distância ao local, precisão GPS, IP/VPN, dispositivo e anti-replay.
// Respostas de negócio vêm sempre com HTTP 200 e { ok: boolean, code }.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hexToBytes, verifySunMessage } from '../_shared/ntag424.ts';
import {
  DUPLICATE_WINDOW_MS,
  evaluatePunch,
  haversineMeters,
  isValidPosition,
  nextEntryType,
  sha256Hex,
  type IpInfo,
  type PositionReading,
} from '../_shared/timeclock-rules.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PunchRequest {
  method?: 'nfc' | 'gps';
  tag?: { t?: string; e?: string; c?: string };
  position?: { lat?: number; lng?: number; accuracy?: number; age_ms?: number };
  device_id?: string;
  entry_type?: 'in' | 'out';
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const LOCATION_COLUMNS =
  'id, company_id, name, latitude, longitude, radius_m, max_accuracy_m, allow_manual, block_vpn, trusted_ips, is_active';

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
    if (data?.status === 'error' || !info) return { checked: false };
    return {
      checked: true,
      country: info.isocode ?? null,
      city: info.city ?? null,
      lat: typeof info.latitude === 'number' ? info.latitude : null,
      lng: typeof info.longitude === 'number' ? info.longitude : null,
      isProxy: info.proxy === 'yes' || info.type === 'VPN' || info.type === 'Hosting',
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

  const { data: employee } = await db
    .from('employees')
    .select('id, company_id, is_active')
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
      latitude: Number.isFinite(position.lat) ? position.lat : null,
      longitude: Number.isFinite(position.lng) ? position.lng : null,
      accuracy_m: Number.isFinite(position.accuracy) ? position.accuracy : null,
      distance_m: Number.isFinite(extra.distance_m) ? extra.distance_m : null,
      ip_address: ip,
      ip_country: extra.ip_country ?? null,
      device_id: deviceId,
      user_agent: userAgent,
    });
    return json({ ok: false, code: reason });
  };

  if (!isValidPosition(position)) return logAttempt('missing_position');

  // 1. Descobrir o local: pela tag (NFC) ou o mais próximo que aceite registo só com GPS.
  let tag: ResolvedTag | null = null;
  let location: LocationRow;
  if (method === 'nfc') {
    const resolved = await resolveTag(db, body.tag);
    if ('error' in resolved) return logAttempt(resolved.error);
    tag = resolved;
    location = resolved.location;
    if (!location.is_active) return logAttempt('invalid_tag', { tag_id: tag.id });
    if (location.company_id !== employee.company_id) {
      return logAttempt('tag_other_company', { tag_id: tag.id, location_id: location.id });
    }
  } else {
    const { data: locations } = await db
      .from('time_clock_locations')
      .select(LOCATION_COLUMNS)
      .eq('company_id', employee.company_id)
      .eq('is_active', true);
    if (!locations?.length) return logAttempt('no_location');
    const manual = (locations as LocationRow[]).filter(l => l.allow_manual);
    if (!manual.length) return logAttempt('manual_not_allowed');
    const here = { lat: position.lat, lng: position.lng };
    location = manual.reduce((best, l) =>
      haversineMeters(here, { lat: l.latitude, lng: l.longitude }) <
      haversineMeters(here, { lat: best.latitude, lng: best.longitude })
        ? l
        : best
    );
  }

  // 2. Contexto: IP, último registo, dispositivo, coordenadas repetidas.
  const since60d = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [ipInfo, lastRes, deviceSeenRes, deviceOthersRes, repeatedRes] = await Promise.all([
    lookupIp(ip),
    db
      .from('time_clock_entries')
      .select('id, entry_type, punched_at, status, flags, source, distance_m, latitude, longitude')
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
    db
      .from('time_clock_entries')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employee.id)
      .eq('latitude', position.lat)
      .eq('longitude', position.lng),
  ]);

  const now = Date.now();
  const last = lastRes.data;
  if (last && now - new Date(last.punched_at).getTime() < DUPLICATE_WINDOW_MS) {
    return json({ ok: true, code: 'duplicate', entry: { ...last, location_name: location.name } });
  }

  // 3. Regras.
  const evaluation = evaluatePunch({
    method,
    position,
    location: {
      lat: location.latitude,
      lng: location.longitude,
      radiusM: location.radius_m,
      maxAccuracyM: location.max_accuracy_m,
      blockVpn: location.block_vpn,
      trustedIps: location.trusted_ips ?? [],
    },
    ip,
    ipInfo,
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

  if (evaluation.rejected) {
    return logAttempt(evaluation.rejected, {
      location_id: location.id,
      tag_id: tag?.id,
      distance_m: evaluation.distanceM,
      flags: evaluation.flags,
      ip_country: ipInfo.country,
    });
  }

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
    if (tag.counter !== null && !updated?.length)
      return logAttempt('replayed_tag', { tag_id: tag.id });
  }

  // 5. Gravar.
  const entryType =
    body.entry_type === 'in' || body.entry_type === 'out'
      ? body.entry_type
      : nextEntryType(
          last
            ? { entry_type: last.entry_type, punchedAtMs: new Date(last.punched_at).getTime() }
            : null,
          now
        );

  const { data: entry, error: insertError } = await db
    .from('time_clock_entries')
    .insert({
      employee_id: employee.id,
      company_id: employee.company_id,
      location_id: location.id,
      tag_id: tag?.id ?? null,
      entry_type: entryType,
      punched_at: new Date(now).toISOString(),
      source: method,
      status: evaluation.status,
      flags: evaluation.flags,
      latitude: position.lat,
      longitude: position.lng,
      accuracy_m: position.accuracy,
      distance_m: Math.round(evaluation.distanceM * 10) / 10,
      ip_address: ip,
      ip_country: ipInfo.country ?? null,
      ip_city: ipInfo.city ?? null,
      ip_is_proxy: ipInfo.checked ? !!ipInfo.isProxy : null,
      device_id: deviceId,
      user_agent: userAgent,
      created_by: userId,
      updated_by: userId,
    })
    .select('id, entry_type, punched_at, status, flags, distance_m, source')
    .single();

  if (insertError) {
    console.error('clock-punch insert error:', insertError);
    return json({ ok: false, code: 'server_error' }, 500);
  }

  return json({ ok: true, code: 'registered', entry: { ...entry, location_name: location.name } });
});
