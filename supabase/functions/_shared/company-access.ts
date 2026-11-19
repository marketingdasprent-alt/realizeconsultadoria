// Decisões de acesso por empresa para as funções de borda. Sem dependências do Deno, para se
// poderem testar (como guard.ts). A verificação em si (RPC rz_is_company_admin / rz_is_super_admin)
// é feita pelo chamador com o cliente DO UTILIZADOR (JWT dele), para a base aplicar pertença ativa,
// identidades unificadas, super admin e MFA (aal2). Com a chave de serviço auth.uid() é nulo.

export type AccessDecision = { ok: true } | { ok: false; status: number; error: string };

export const EMPLOYEE_NOT_FOUND = 'Colaborador não encontrado';
export const COMPANY_FORBIDDEN = 'Sem permissão para administrar esta empresa';
export const SUPER_ADMIN_ONLY = 'Só um super administrador pode fazer isto';
export const CHECK_FAILED = 'Não foi possível verificar as permissões';

/** Resultado da RPC: true/false, ou null quando a verificação falhou (erro, sem resposta). */
export type RpcCheck = boolean | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const ok: AccessDecision = { ok: true };
const fail = (status: number, error: string): AccessDecision => ({ ok: false, status, error });

/**
 * Alvo identificado por colaborador. `employeeCompanyId` é a empresa da ficha lida com a chave de
 * serviço (null/undefined = a ficha não existe). Alvo inexistente e alvo de outra empresa dão a
 * MESMA resposta (404), para não revelar que a ficha existe.
 */
export const decideEmployeeAccess = async (
  employeeCompanyId: string | null | undefined,
  isCompanyAdmin: (companyId: string) => Promise<RpcCheck>
): Promise<AccessDecision> => {
  if (!isUuid(employeeCompanyId)) return fail(404, EMPLOYEE_NOT_FOUND);
  const allowed = await isCompanyAdmin(employeeCompanyId);
  if (allowed === null) return fail(500, CHECK_FAILED);
  return allowed ? ok : fail(404, EMPLOYEE_NOT_FOUND);
};

/** Alvo identificado por empresa (ex.: criar colaborador): o chamador tem de a administrar. */
export const decideCompanyAccess = async (
  companyId: unknown,
  isCompanyAdmin: (companyId: string) => Promise<RpcCheck>
): Promise<AccessDecision> => {
  if (!isUuid(companyId)) return fail(400, 'company_id inválido');
  const allowed = await isCompanyAdmin(companyId);
  if (allowed === null) return fail(500, CHECK_FAILED);
  return allowed ? ok : fail(403, COMPANY_FORBIDDEN);
};

/**
 * Vários alvos (envio em massa): todas as empresas distintas têm de ser administradas pelo
 * chamador; basta uma que não seja e nada avança. Verifica por empresa distinta, não por pessoa.
 * Um id em falta (ficha inexistente) conta como fora do âmbito.
 */
export const decideManyCompaniesAccess = async (
  companyIds: ReadonlyArray<string | null | undefined>,
  isCompanyAdmin: (companyId: string) => Promise<RpcCheck>
): Promise<AccessDecision> => {
  const distinct = new Set<string>();
  for (const id of companyIds) {
    if (!isUuid(id)) return fail(403, COMPANY_FORBIDDEN);
    distinct.add(id);
  }
  for (const id of distinct) {
    const allowed = await isCompanyAdmin(id);
    if (allowed === null) return fail(500, CHECK_FAILED);
    if (!allowed) return fail(403, COMPANY_FORBIDDEN);
  }
  return ok;
};

/** Funções de conta administrativa global: só super admin. */
export const decideSuperAdminAccess = (isSuperAdmin: RpcCheck): AccessDecision =>
  isSuperAdmin === null ? fail(500, CHECK_FAILED) : isSuperAdmin ? ok : fail(403, SUPER_ADMIN_ONLY);

// ---- A2: a ficha aponta para uma conta com poderes de administrador -----------------------------
// O admin de uma empresa consegue escrever employees.user_id/email. Antes de agir sobre a conta de
// destino de uma ficha (palavra-passe, email, ban), recusar (mesma 404) se essa conta tiver poderes
// fora do âmbito de quem chama. Um admin da mesma empresa que também é colaborador dela continua
// a poder ser tratado pelos admins dessa empresa.

export interface TargetAccountFacts {
  /** platform_admins ativo (super admin) para alguma das identidades da conta. */
  isPlatformAdmin: boolean;
  /** user_roles.admin (admin global). */
  hasAdminRole: boolean;
  /** Em admin_group_members de um grupo ativo (is_admin_account / get_admin_permissions). */
  inAdminGroup: boolean;
  /** Em grupo ativo com is_super_admin: poderes de super admin sem estar em platform_admins. */
  inSuperAdminGroup: boolean;
  /** Empresas onde a conta tem pertença de admin ativa. */
  adminCompanyIds: ReadonlyArray<string>;
  /** Todas as empresas onde a conta tem pertença ativa (colaborador ou admin). */
  memberCompanyIds: ReadonlyArray<string>;
}

export const decideTargetAccountAccess = async (
  callerIsSuperAdmin: boolean,
  target: TargetAccountFacts,
  isCompanyAdmin: (companyId: string) => Promise<RpcCheck>
): Promise<AccessDecision> => {
  if (callerIsSuperAdmin) return ok;
  if (target.isPlatformAdmin || target.inSuperAdminGroup) return fail(404, EMPLOYEE_NOT_FOUND);
  // Admin global (papel ou grupo) sem pertença de admin em nenhuma empresa: não é de nenhuma
  // empresa do chamador
  if ((target.hasAdminRole || target.inAdminGroup) && target.adminCompanyIds.length === 0) {
    return fail(404, EMPLOYEE_NOT_FOUND);
  }
  // Todas as empresas onde a conta tem pertença ativa têm de ser do chamador (fecha a ficha de A
  // apontada ao colaborador de B). Sem nenhuma pertença não há nada a verificar.
  for (const companyId of new Set([...target.adminCompanyIds, ...target.memberCompanyIds])) {
    const allowed = await isCompanyAdmin(companyId);
    if (allowed === null) return fail(500, CHECK_FAILED);
    if (!allowed) return fail(404, EMPLOYEE_NOT_FOUND);
  }
  return ok;
};

/**
 * Ao eliminar uma ficha só se bane a conta de acesso quando não tem outra ficha ativa nem outra
 * pertença ativa (outra empresa, ou admin): senão desativa-se só a ficha.
 */
export const shouldBanAccount = (
  otherActiveEmployees: number,
  otherActiveMemberships: number
): boolean => otherActiveEmployees === 0 && otherActiveMemberships === 0;

// ---- Âmbito do envio de comunicados (broadcast-send) ----------------------------------------------

export const SUPER_ONLY_BROADCAST = 'Só um super administrador pode enviar a todas as empresas.';

export interface ScopeNeeds {
  /** Empresas (por pessoa/aviso) que o chamador tem de administrar; null = sem empresa (recusa). */
  companyIds: ReadonlyArray<string | null>;
  /** O envio é global (company_id nulo): só super admin. */
  needsSuperAdmin: boolean;
  /** Algum aviso pedido não existe: conta como fora do âmbito. */
  unknownNotice?: boolean;
}

export const broadcastScope = (input: {
  test: boolean;
  publishInApp: boolean;
  audienceMode: string | undefined;
  audienceCompanyIds: ReadonlyArray<string>;
  peopleCompanyIds: ReadonlyArray<string | null>;
}): ScopeNeeds => {
  // Teste: só vai por email para quem o pede; não há pessoas nem publicação na app
  if (input.test) return { companyIds: [], needsSuperAdmin: false };
  return {
    companyIds: [
      ...input.peopleCompanyIds,
      ...(input.audienceMode === 'company' ? input.audienceCompanyIds : []),
    ],
    needsSuperAdmin: input.publishInApp && input.audienceMode === 'all',
  };
};

export const remindScope = (input: {
  peopleCompanyIds: ReadonlyArray<string | null>;
  notices: ReadonlyArray<{ company_id: string | null; employee_id: string | null }>;
  requestedNotices: number;
  /** Empresa da ficha de cada aviso por pessoa (employee_id -> company_id). */
  companyOfEmployee: ReadonlyMap<string, string | null>;
}): ScopeNeeds => {
  const companyIds: (string | null)[] = [...input.peopleCompanyIds];
  let needsSuperAdmin = false;
  for (const notice of input.notices) {
    if (notice.company_id) companyIds.push(notice.company_id);
    else if (notice.employee_id) {
      companyIds.push(input.companyOfEmployee.get(notice.employee_id) ?? null);
    } else needsSuperAdmin = true; // aviso para todas as empresas
  }
  return {
    companyIds,
    needsSuperAdmin,
    unknownNotice: input.notices.length !== input.requestedNotices,
  };
};

export const decideScope = async (
  scope: ScopeNeeds,
  isCompanyAdmin: (companyId: string) => Promise<RpcCheck>,
  isSuperAdmin: () => Promise<RpcCheck>
): Promise<AccessDecision> => {
  if (scope.unknownNotice) return fail(403, COMPANY_FORBIDDEN);
  if (scope.needsSuperAdmin) {
    const isSuper = await isSuperAdmin();
    if (isSuper === null) return fail(500, CHECK_FAILED);
    if (!isSuper) return fail(403, SUPER_ONLY_BROADCAST);
  }
  return decideManyCompaniesAccess(scope.companyIds, isCompanyAdmin);
};
