// Funções que só o admin chama (palavras-passe, emails e contas): estão publicadas com
// verify_jwt = false, por isso quem chama tem de ser verificado aqui — senão bastava a chave
// pública para mudar a palavra-passe de um administrador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const reply = (status: number, error: string, headers: Record<string, string>) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

export interface AdminCaller {
  userId: string;
  email: string | null;
}

/**
 * Quem chama, se for administrador (papel admin ou grupo de admin ativo); senão a resposta
 * 401/403 para devolver logo.
 */
export const adminCaller = async (
  req: Request,
  headers: Record<string, string>
): Promise<AdminCaller | Response> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return reply(401, 'Sessão em falta', headers);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getClaims(authHeader.slice('Bearer '.length));
  const userId = data?.claims?.sub;
  if (error || !userId) return reply(401, 'Sessão inválida', headers);

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [role, groups] = await Promise.all([
    db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').limit(1),
    db
      .from('admin_group_members')
      .select('admin_groups!inner(is_active)')
      .eq('user_id', userId)
      .eq('admin_groups.is_active', true)
      .limit(1),
  ]);
  if ((role.data?.length ?? 0) > 0 || (groups.data?.length ?? 0) > 0) {
    const email = typeof data.claims.email === 'string' ? data.claims.email : null;
    return { userId, email };
  }
  return reply(403, 'Só um administrador pode fazer isto', headers);
};

/** Sessão de administrador ou uma resposta 401/403 para devolver logo. `null` = pode continuar. */
export const denyUnlessAdmin = async (
  req: Request,
  headers: Record<string, string>
): Promise<Response | null> => {
  const caller = await adminCaller(req, headers);
  return caller instanceof Response ? caller : null;
};
