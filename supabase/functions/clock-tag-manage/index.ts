// Gestão de tags NFC do ponto (apenas admins com permissão timeclock/locations).
//
// POST { action: 'create_static', location_id, label }
//   → gera token aleatório, guarda só o SHA-256 e devolve o token UMA vez
// POST { action: 'rotate_static', tag_id }
//   → novo token (a tag antiga deixa de funcionar; é preciso regravá-la)
// POST { action: 'register_ntag424', location_id, label, e, c }
//   → valida a mensagem SUN com a chave do servidor e regista o UID da tag
// POST { action: 'resolve_maps_link', url }
//   → segue um link curto do Google Maps (maps.app.goo.gl) e devolve { lat, lng }

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hexToBytes, verifySunMessage } from '../_shared/ntag424.ts';
import { sha256Hex } from '../_shared/timeclock-rules.ts';
import {
  extractMapsCoordinates,
  isGoogleHost,
  type MapsCoordinates,
} from '../_shared/maps-link.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TagManageRequest {
  action?: 'create_static' | 'rotate_static' | 'register_ntag424' | 'resolve_maps_link';
  location_id?: string;
  tag_id?: string;
  label?: string;
  e?: string;
  c?: string;
  url?: string;
}

const TAG_COLUMNS = 'id, location_id, label, tag_type, uid, is_active, last_used_at, created_at';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** 24 bytes aleatórios em base64url (32 caracteres) — cabe numa NTAG213. */
const generateToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Segue os redirecionamentos de um link do Google Maps (sem sair de domínios
 * Google) até um URL com coordenadas. Não lê o HTML: o mapa lá contido é o
 * centro genérico da região, não o local partilhado.
 */
const resolveMapsLink = async (raw: string): Promise<MapsCoordinates | null> => {
  let current: URL;
  try {
    current = new URL(raw.trim());
  } catch {
    return null;
  }
  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== 'https:' || !isGoogleHost(current.hostname)) return null;
    const direct = extractMapsCoordinates(current.href);
    if (direct) return direct;

    const res = await fetch(current.href, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (RealizePonto)', 'Accept-Language': 'pt-PT,pt;q=0.9' },
      signal: AbortSignal.timeout(5000),
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      current = new URL(location, current);
      continue;
    }
    await res.body?.cancel();
    return null;
  }
  return null;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace('Bearer ', '')
  );
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return json({ error: 'Token inválido' }, 401);

  const { data: allowed } = await db.rpc('has_timeclock_permission', {
    _user_id: userId,
    _permission: 'execute',
    _topic_key: 'locations',
  });
  if (!allowed) return json({ error: 'Sem permissão para gerir tags' }, 403);

  let body: TagManageRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Pedido inválido' }, 400);
  }

  const label = body.label?.trim().slice(0, 100);

  if (body.action === 'resolve_maps_link') {
    if (!body.url || body.url.length > 2000) return json({ error: 'Link inválido' }, 400);
    try {
      const coords = await resolveMapsLink(body.url);
      if (!coords) return json({ error: 'Não foi possível ler coordenadas deste link' }, 422);
      return json({ coordinates: coords });
    } catch {
      return json({ error: 'Não foi possível abrir o link do Google Maps' }, 502);
    }
  }

  if (body.action === 'create_static') {
    if (!body.location_id || !label) return json({ error: 'Local e nome são obrigatórios' }, 400);
    const token = generateToken();
    const { data, error } = await db
      .from('time_clock_tags')
      .insert({
        location_id: body.location_id,
        label,
        tag_type: 'static',
        token_hash: await sha256Hex(token),
        created_by: userId,
      })
      .select(TAG_COLUMNS)
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ tag: data, token });
  }

  if (body.action === 'rotate_static') {
    if (!body.tag_id) return json({ error: 'Tag obrigatória' }, 400);
    const token = generateToken();
    const { data, error } = await db
      .from('time_clock_tags')
      .update({ token_hash: await sha256Hex(token) })
      .eq('id', body.tag_id)
      .eq('tag_type', 'static')
      .select(TAG_COLUMNS)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'Tag não encontrada' }, 404);
    return json({ tag: data, token });
  }

  if (body.action === 'register_ntag424') {
    if (!body.location_id || !label || !body.e || !body.c) {
      return json({ error: 'Local, nome e leitura da tag são obrigatórios' }, 400);
    }
    const metaKeyHex = Deno.env.get('NTAG424_SDM_KEY');
    if (!metaKeyHex)
      return json({ error: 'Chave NTAG424_SDM_KEY não configurada no servidor' }, 500);
    const sun = await verifySunMessage(
      body.e,
      body.c,
      hexToBytes(metaKeyHex),
      hexToBytes(Deno.env.get('NTAG424_SDM_FILE_KEY') ?? metaKeyHex)
    );
    if (!sun.valid || !sun.uid || sun.counter === undefined) {
      return json(
        { error: 'Leitura inválida: a tag não está programada com a chave do servidor' },
        400
      );
    }
    const { data, error } = await db
      .from('time_clock_tags')
      .insert({
        location_id: body.location_id,
        label,
        tag_type: 'ntag424',
        uid: sun.uid,
        // A leitura usada no registo não pode depois ser usada para picar o ponto.
        last_counter: sun.counter,
        created_by: userId,
      })
      .select(TAG_COLUMNS)
      .single();
    if (error) {
      const duplicate = error.code === '23505';
      return json({ error: duplicate ? 'Esta tag já está registada' : error.message }, 400);
    }
    return json({ tag: data });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
