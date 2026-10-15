// Utilitários HTTP das edge functions do Webmail (mail-oauth, mail-api). Só Deno.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Cliente service role (ignora RLS): só para uso dentro das funções. */
export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/** Id do utilizador do JWT (Authorization: Bearer ...) ou null. */
export const authenticatedUserId = async (
  req: Request,
  db: SupabaseClient
): Promise<string | null> => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await db.auth.getUser(header.slice(7).trim());
  return error ? null : (data.user?.id ?? null);
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** fetch com timeout (os fornecedores às vezes ficam pendurados). */
export const fetchWithTimeout = async (
  url: string,
  init: RequestInit = {},
  timeoutMs = 20_000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** Corre `fn` sobre os itens com no máximo `limit` pedidos em simultâneo (mantém a ordem). */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
