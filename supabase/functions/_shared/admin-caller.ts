// Funções que só o admin chama (palavras-passe, emails e contas): estão publicadas com
// verify_jwt = false, por isso quem chama tem de ser verificado aqui — senão bastava a chave
// pública para mudar a palavra-passe de um administrador.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  decideCompanyAccess,
  decideEmployeeAccess,
  decideManyCompaniesAccess,
  decideScope,
  decideSuperAdminAccess,
  decideTargetAccountAccess,
  type AccessDecision,
  type RpcCheck,
  type ScopeNeeds,
} from './company-access.ts';

const reply = (status: number, error: string, headers: Record<string, string>) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

export interface AdminCaller {
  userId: string;
  email: string | null;
  /** Cliente com o JWT de quem chama: auth.uid() e aal certos nas RPC rz_is_*. */
  userClient: SupabaseClient;
  /** Cliente de serviço (contorna a RLS): só para ler o alvo. */
  db: SupabaseClient;
}

/**
 * Sessão válida (JWT verificado), sem exigir papel de admin: nas funções por empresa a decisão é
 * da RPC rz_is_company_admin / rz_is_super_admin com o cliente do utilizador (a pertença é a fonte
 * de verdade). Senão a resposta 401 para devolver logo.
 */
export const authenticatedCaller = async (
  req: Request,
  headers: Record<string, string>
): Promise<AdminCaller | Response> => {
  try {
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
    const email = typeof data.claims.email === 'string' ? data.claims.email : null;
    return { userId, email, userClient, db };
  } catch (error) {
    console.error('[authenticatedCaller]', error instanceof Error ? error.name : 'erro');
    return reply(500, 'Erro interno', headers);
  }
};

/**
 * Quem chama, se for administrador (papel admin ou grupo de admin ativo); senão a resposta
 * 401/403 para devolver logo. Para as funções que não são do âmbito por empresa.
 */
export const adminCaller = async (
  req: Request,
  headers: Record<string, string>
): Promise<AdminCaller | Response> => {
  const caller = await authenticatedCaller(req, headers);
  if (caller instanceof Response) return caller;
  try {
    // Papel admin ou grupo de admin ativo, na conta da sessão ou na conta de admin ligada à ficha
    // (contas unificadas colaborador + admin: ver rz_identity_ids na BD)
    const { data: isAdmin } = await caller.db.rpc('is_admin_account', { _user_id: caller.userId });
    if (isAdmin === true) return caller;
    return reply(403, 'Só um administrador pode fazer isto', headers);
  } catch (error) {
    console.error('[adminCaller]', error instanceof Error ? error.name : 'erro');
    return reply(500, 'Erro interno', headers);
  }
};

/** Sessão de administrador ou uma resposta 401/403 para devolver logo. `null` = pode continuar. */
export const denyUnlessAdmin = async (
  req: Request,
  headers: Record<string, string>
): Promise<Response | null> => {
  const caller = await adminCaller(req, headers);
  return caller instanceof Response ? caller : null;
};

const denyWith = (decision: AccessDecision, headers: Record<string, string>): Response | null =>
  decision.ok ? null : reply(decision.status, decision.error, headers);

/** Qualquer exceção (rede, RPC) vira 500 genérico com CORS e sem detalhe interno. */
const safely = async (
  headers: Record<string, string>,
  what: string,
  run: () => Promise<Response | null>
): Promise<Response | null> => {
  try {
    return await run();
  } catch (error) {
    console.error(`[${what}]`, error instanceof Error ? error.name : 'erro');
    return reply(500, 'Erro interno', headers);
  }
};

/** RPC booleana com o cliente do utilizador; erro ou resposta estranha = null (nunca passa). */
const rpcCheck = async (
  caller: AdminCaller,
  fn: string,
  args?: Record<string, unknown>
): Promise<RpcCheck> => {
  const { data, error } = await caller.userClient.rpc(fn, args);
  return error || typeof data !== 'boolean' ? null : data;
};

export const isCompanyAdminOf =
  (caller: AdminCaller) =>
  (companyId: string): Promise<RpcCheck> =>
    rpcCheck(caller, 'rz_is_company_admin', { company: companyId });

/** É super admin (com MFA, via cliente do utilizador)? Para ramos em que a função decide. */
export const isSuperAdmin = async (caller: AdminCaller): Promise<boolean> =>
  (await rpcCheck(caller, 'rz_is_super_admin')) === true;

/** Como isSuperAdmin mas devolve null se a verificação falhar (para decidir com 500). */
export const superAdminCheck = (caller: AdminCaller): Promise<RpcCheck> =>
  rpcCheck(caller, 'rz_is_super_admin');

/** Poderes da conta de destino de uma ficha, lidos com a chave de serviço. null = falhou a leitura. */
const targetAccountFacts = async (caller: AdminCaller, targetUserId: string) => {
  const { data: ids, error: idsError } = await caller.db.rpc('rz_identity_ids', {
    _user_id: targetUserId,
  });
  if (idsError || !Array.isArray(ids)) return null;
  const identities = ids as string[];
  const [platform, roles, groups, memberships] = await Promise.all([
    caller.db
      .from('platform_admins')
      .select('user_id')
      .eq('active', true)
      .in('user_id', identities),
    caller.db.from('user_roles').select('user_id').eq('role', 'admin').in('user_id', identities),
    // Grupos de admin ativos (is_admin_account / get_admin_permissions): admin_group_members(user_id,
    // group_id) + admin_groups(id, is_active, is_super_admin)
    caller.db
      .from('admin_group_members')
      .select('admin_groups!inner(is_active, is_super_admin)')
      .in('user_id', identities)
      .eq('admin_groups.is_active', true),
    // Todas as pertenças ativas (colaborador ou admin): a sync cria uma por ficha com user_id
    caller.db
      .from('company_memberships')
      .select('company_id, role')
      .eq('status', 'ativo')
      .in('user_id', identities),
  ]);
  if (platform.error || roles.error || groups.error || memberships.error) return null;
  const groupRows = (groups.data ?? []) as unknown as {
    admin_groups: { is_super_admin: boolean | null } | { is_super_admin: boolean | null }[] | null;
  }[];
  const inSuperAdminGroup = groupRows.some(row =>
    [row.admin_groups].flat().some(group => group?.is_super_admin === true)
  );
  const rows = memberships.data ?? [];
  return {
    isPlatformAdmin: (platform.data ?? []).length > 0,
    hasAdminRole: (roles.data ?? []).length > 0,
    inAdminGroup: groupRows.length > 0,
    inSuperAdminGroup,
    adminCompanyIds: rows.filter(row => row.role === 'admin').map(row => row.company_id as string),
    memberCompanyIds: rows.map(row => row.company_id as string),
  };
};

/**
 * Alvo = colaborador. Inexistente, de outra empresa ou com conta de destino com poderes fora do
 * âmbito de quem chama: a mesma resposta 404. null = pode continuar.
 */
export const denyUnlessEmployeeAdmin = (
  caller: AdminCaller,
  headers: Record<string, string>,
  employeeId: unknown
): Promise<Response | null> =>
  safely(headers, 'employeeAccess', async () => {
    let companyId: string | null = null;
    let targetUserId: string | null = null;
    if (typeof employeeId === 'string') {
      const { data, error } = await caller.db
        .from('employees')
        .select('company_id, user_id')
        .eq('id', employeeId)
        .maybeSingle();
      // Erro da base não é "não existe": 500 geral (404 só para ficha inexistente)
      if (error) return reply(500, 'Não foi possível verificar as permissões', headers);
      companyId = (data?.company_id as string | null | undefined) ?? null;
      targetUserId = (data?.user_id as string | null | undefined) ?? null;
    }
    const byCompany = await decideEmployeeAccess(companyId, isCompanyAdminOf(caller));
    if (!byCompany.ok || !targetUserId) return denyWith(byCompany, headers);

    // A2: o admin da empresa também escreve employees.user_id; a conta de destino não pode ter
    // poderes fora do âmbito de quem chama
    const callerIsSuper = await isSuperAdmin(caller);
    const facts = callerIsSuper ? null : await targetAccountFacts(caller, targetUserId);
    if (!callerIsSuper && !facts) {
      return reply(500, 'Não foi possível verificar as permissões', headers);
    }
    const byAccount = await decideTargetAccountAccess(
      callerIsSuper,
      facts ?? {
        isPlatformAdmin: false,
        hasAdminRole: false,
        inAdminGroup: false,
        inSuperAdminGroup: false,
        adminCompanyIds: [],
        memberCompanyIds: [],
      },
      isCompanyAdminOf(caller)
    );
    return denyWith(byAccount, headers);
  });

/** Alvo = empresa (ex.: criar colaborador). */
export const denyUnlessCompanyAdmin = (
  caller: AdminCaller,
  headers: Record<string, string>,
  companyId: unknown
): Promise<Response | null> =>
  safely(headers, 'companyAccess', async () =>
    denyWith(await decideCompanyAccess(companyId, isCompanyAdminOf(caller)), headers)
  );

/** Várias empresas de uma vez. */
export const denyUnlessCompaniesAdmin = (
  caller: AdminCaller,
  headers: Record<string, string>,
  companyIds: ReadonlyArray<string | null | undefined>
): Promise<Response | null> =>
  safely(headers, 'companiesAccess', async () =>
    denyWith(await decideManyCompaniesAccess(companyIds, isCompanyAdminOf(caller)), headers)
  );

/** Âmbito de um envio (destinatários, empresas, modo global): ver decideScope. */
export const denyUnlessScope = (
  caller: AdminCaller,
  headers: Record<string, string>,
  scope: ScopeNeeds
): Promise<Response | null> =>
  safely(headers, 'scopeAccess', async () =>
    denyWith(
      await decideScope(scope, isCompanyAdminOf(caller), () => superAdminCheck(caller)),
      headers
    )
  );

/** Contas administrativas globais: só super admin. null = pode continuar. */
export const denyUnlessSuperAdmin = (
  caller: AdminCaller,
  headers: Record<string, string>
): Promise<Response | null> =>
  safely(headers, 'superAdminAccess', async () =>
    denyWith(decideSuperAdminAccess(await superAdminCheck(caller)), headers)
  );
