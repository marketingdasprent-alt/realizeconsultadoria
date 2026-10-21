// Passar do Workspace para o admin (ou ao contrário) sem voltar a pedir a palavra-passe.
//
// POST { to: 'admin' | 'workspace' } com a sessão atual → { ok, token_hash }.
// A conta de destino é a própria (se já é dessa área) ou a ligada na ficha do colaborador
// (employees.admin_user_id, só um super admin liga) — decide account_switch_target na BD.
// O token_hash é de uso único: o outro site troca-o pela sessão (verifyOtp) em /auth/trocar.
// Nenhum email é enviado.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, code: 'unauthorized' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(
    authHeader.slice('Bearer '.length)
  );
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return json({ ok: false, code: 'unauthorized' }, 401);

  let to: unknown;
  try {
    ({ to } = await req.json());
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  if (to !== 'admin' && to !== 'workspace') return json({ ok: false, code: 'bad_request' }, 400);

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: targetId, error: targetError } = await db.rpc('account_switch_target', {
    _user_id: userId,
    _to: to,
  });
  if (targetError) {
    console.error('[switch-account] target', targetError.message);
    return json({ ok: false, code: 'server_error' }, 500);
  }
  if (!targetId) return json({ ok: false, code: 'not_linked' }, 403);

  const { data: target, error: userError } = await db.auth.admin.getUserById(targetId as string);
  const email = target?.user?.email;
  if (userError || !email) return json({ ok: false, code: 'not_linked' }, 403);

  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error('[switch-account] link', linkError?.message);
    return json({ ok: false, code: 'server_error' }, 500);
  }
  return json({ ok: true, token_hash: tokenHash });
});
