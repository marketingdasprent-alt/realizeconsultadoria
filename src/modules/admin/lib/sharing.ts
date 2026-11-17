// Partilha entre empresas: tipos, mensagens de erro e ajudantes puros.
// O contrato das chamadas está em docs/multiempresa/CONTRATO.md, secção 2.5.

export type RequestStatus = 'pedido' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado';
export type ShareStatus = 'pedido' | 'aprovado' | 'revogado';
export type ShareOrigin = 'pedido' | 'legado';

export interface MyCompany {
  company_id: string;
  name: string;
  role: string;
  status: string;
  origin: string;
  is_group_member: boolean;
}

/** Quem gere a empresa: o admin dela, ou um Super Admin (equipa da plataforma, todas as empresas). */
export const managesCompany = (role: string) => role === 'admin' || role === 'super_admin';

export type ViewerKind = 'super_admin' | 'admin_empresa' | 'gestor';

/** Quem pode ver os dados de uma empresa (rz_company_viewers). */
export interface CompanyViewer {
  user_id: string;
  name: string;
  email: string;
  kind: ViewerKind;
  role: string;
}

export const VIEWER_KIND_LABEL: Record<ViewerKind, string> = {
  super_admin: 'Equipa da plataforma',
  admin_empresa: 'Administrador da empresa',
  gestor: 'Gestor',
};

export const viewerKindLabel = (kind: string): string =>
  VIEWER_KIND_LABEL[kind as ViewerKind] ?? kind;

export interface ShareCode {
  share_code: string;
  rotated_at: string | null;
}

export interface Capability {
  capability: string;
  module: string;
  kind: 'read' | 'write' | 'special';
  grantable: boolean;
  sensitive: boolean;
  min_role: string;
  description: string | null;
}

export interface ShareRequest {
  request_id: string;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
  /** Em pedidos enviados só vem preenchido depois de aprovado. */
  other_company_id: string | null;
  other_company_name: string | null;
  ask: string[];
  offer: string[];
  decided_at: string | null;
  decision_note: string | null;
}

export interface Share {
  share_id: string;
  /** `dada`: a minha empresa é a dona dos dados; `recebida`: é a beneficiária. */
  direction: 'dada' | 'recebida';
  other_company_id: string;
  other_company_name: string;
  capability: string;
  capability_description: string | null;
  sensitive: boolean;
  status: ShareStatus;
  origin: ShareOrigin;
  approved_at: string | null;
  legacy_confirmed_at: string | null;
  legacy_due_at: string | null;
  revoked_at: string | null;
}

export interface GroupMember {
  group_id: string;
  company_id: string;
  name: string;
  joined_at: string;
  origin: 'pedido' | 'migracao';
  is_me: boolean;
}

export type RequestDirection = 'received' | 'sent';

/** Erro de uma chamada de partilha, com o código estável do servidor. */
export class SharingError extends Error {
  readonly code: string;
  readonly detail: string | null;
  constructor(code: string, detail: string | null = null) {
    super(code);
    this.name = 'SharingError';
    this.code = code;
    this.detail = detail;
  }
}

/** Frase única mostrada a quem pede ligação: não revela se o código existe. */
export const REQUEST_SUBMITTED_NOTICE =
  'Se o código estiver correto, a empresa recebe o pedido e responde ao seu administrador.';

const ERROR_TEXT: Record<string, string> = {
  not_authenticated: 'A sessão terminou. Entre outra vez.',
  forbidden: 'Só os administradores da empresa podem fazer isto.',
  not_company_admin: 'Só os administradores da empresa podem fazer isto.',
  not_platform_admin: 'Esta ação é só para a administração da plataforma.',
  module_not_grantable: 'Uma das permissões escolhidas não pode ser partilhada.',
  reauth_required: 'Confirme a sua palavra-passe para continuar.',
  reauth_failed: 'A palavra-passe não está certa.',
  invalid_argument: 'Há dados em falta ou inválidos. Reveja o formulário.',
  unknown_capability: 'Uma das permissões escolhidas não existe.',
  nothing_to_grant: 'Escolha pelo menos uma permissão para partilhar.',
  reason_required: 'Indique o motivo.',
  duration_too_long: 'A duração é maior do que o permitido.',
  not_found: 'Não encontrado, ou sem direito de o ver.',
  request_not_pending: 'Este pedido já foi tratado.',
  request_expired: 'Este pedido expirou. A outra empresa tem de o fazer de novo.',
  share_not_active: 'Esta partilha já não está ativa.',
  already_pending: 'Já existe um pedido por responder entre as duas empresas.',
  already_shared: 'As duas empresas já partilham estas permissões.',
  last_admin: 'A empresa ficaria sem administrador.',
  rate_limited: 'Demasiadas tentativas. Tente de novo dentro de uma hora.',
  cross_company_violation: 'Esta alteração não é permitida entre empresas.',
  unavailable: 'A partilha entre empresas ainda não está ativa neste ambiente.',
  unknown: 'Não foi possível concluir. Tente outra vez.',
};

/** Texto em português de Portugal para um erro (nunca mostra o código). */
export const sharingErrorText = (error: unknown): string => {
  if (error instanceof SharingError)
    return ERROR_TEXT[error.code] ?? error.detail ?? ERROR_TEXT.unknown;
  return ERROR_TEXT.unknown;
};

export const isReauthRequired = (error: unknown): boolean =>
  error instanceof SharingError && error.code === 'reauth_required';

/**
 * Converte o erro do Supabase num SharingError: `message` traz o código estável do contrato.
 * Função inexistente (PGRST202 / 42883) significa que a migração ainda não foi aplicada.
 */
export const toSharingError = (error: {
  message?: string;
  details?: string | null;
  code?: string;
}): SharingError => {
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01')
    return new SharingError('unavailable');
  if (error.code === 'RZ401') return new SharingError('reauth_required', error.details ?? null);
  if (error.code === 'RZ429') return new SharingError('rate_limited', error.details ?? null);
  const code = /^[a-z_]+$/.test(error.message ?? '') ? (error.message as string) : 'unknown';
  return new SharingError(code, error.details ?? null);
};

export const MODULE_LABEL: Record<string, string> = {
  directory: 'Colaboradores',
  tickets: 'Tickets',
  access: 'Acessos',
  mail: 'Emails',
  chat: 'Chat',
  tasks: 'Tarefas',
  equipment: 'Equipamentos',
  feed: 'Comunicados de grupo',
  hr: 'Recursos humanos',
  finance: 'Financeiro',
  docs: 'Documentos',
};

export const moduleLabel = (module: string): string => MODULE_LABEL[module] ?? module;

/** Nome legível de uma permissão: a descrição do catálogo, ou o código se faltar. */
export const capabilityLabel = (capability: string, catalog: readonly Capability[]): string =>
  catalog.find(item => item.capability === capability)?.description ?? capability;

export interface CapabilityGroup {
  module: string;
  label: string;
  items: Capability[];
}

/** Só as permissões que se podem partilhar, agrupadas por módulo (a ordem do catálogo). */
export const groupGrantable = (catalog: readonly Capability[]): CapabilityGroup[] => {
  const groups = new Map<string, Capability[]>();
  for (const item of catalog) {
    if (!item.grantable) continue;
    groups.set(item.module, [...(groups.get(item.module) ?? []), item]);
  }
  return [...groups].map(([module, items]) => ({ module, label: moduleLabel(module), items }));
};

/** O código da empresa, em dois blocos de cinco para ler e ditar (ABCDE FGHJK). */
export const formatShareCode = (code: string): string =>
  code.length === 10 ? `${code.slice(0, 5)} ${code.slice(5)}` : code;

const CODE_ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;

/** Limpa o que a pessoa escreveu (espaços, minúsculas) e diz se parece um código válido. */
export const normalizeShareCode = (raw: string): { code: string; valid: boolean } => {
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return { code, valid: CODE_ALPHABET.test(code) };
};

/** Pedidos por responder primeiro; dentro de cada estado, os mais recentes. */
export const sortRequests = (requests: readonly ShareRequest[]): ShareRequest[] =>
  [...requests].sort((a, b) => {
    const open = Number(b.status === 'pedido') - Number(a.status === 'pedido');
    return open || b.created_at.localeCompare(a.created_at);
  });

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pedido: 'Por responder',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

/** Dias que faltam até à data (0 se já passou). */
export const daysUntil = (iso: string, now: Date = new Date()): number =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));

/** Há partilhas de legado por confirmar? (o admin dono confirma ou revoga) */
export const needsLegacyConfirmation = (share: Share): boolean =>
  share.direction === 'dada' &&
  share.origin === 'legado' &&
  share.status === 'aprovado' &&
  !share.legacy_confirmed_at;
