// Mover colaboradores entre empresas e gerir administradores: tipos, validação dos resultados da
// base e ajudantes puros. O contrato está em docs/multiempresa/FASE-C1.md.
import { z } from 'zod';
import { sortCompanies } from '@/lib/companyName';
import {
  SharingError,
  managesCompany,
  sharingErrorText,
  viewerKindLabel,
  type CompanyViewer,
  type MyCompany,
} from './sharing';

// --------------------------------------------------------------------------- resultados

const count = z.number().int().nonnegative().catch(0);

export const pendingEffectsSchema = z.object({
  tasks_open_assigned: count,
  tasks_open_participant: count,
  events_future_attending: count,
  events_future_owned: count,
  folders_assigned: count,
  chat_conversations_origin: count,
});

export const transferResultSchema = z.object({
  employee_id: z.string(),
  from_company: z.string(),
  to_company: z.string(),
  note: z.string().nullable().optional(),
  pending_effects: pendingEffectsSchema,
});

export const bulkItemSchema = z.object({
  employee_id: z.string(),
  ok: z.boolean(),
  result: transferResultSchema.optional(),
  error: z.string().optional(),
  detail: z.string().nullable().optional(),
});

export const bulkResultSchema = z.object({
  total: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(bulkItemSchema),
});

export type PendingEffects = z.infer<typeof pendingEffectsSchema>;
export type TransferResult = z.infer<typeof transferResultSchema>;
export type BulkItem = z.infer<typeof bulkItemSchema>;
export type BulkTransferResult = z.infer<typeof bulkResultSchema>;

export type AdminRole = 'admin' | 'gestor';

export interface AdminChange {
  company_id: string;
  user_id: string;
  role: string;
  previous_role?: string | null;
  status?: string;
}

const adminChangeSchema = z.object({
  company_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  previous_role: z.string().nullable().optional(),
  status: z.string().optional(),
});

/** Valida o que a base devolveu; uma resposta fora do contrato é um erro desconhecido. */
const parse = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) throw new SharingError('unknown');
  return result.data;
};

export const parseTransferResult = (data: unknown): TransferResult =>
  parse(transferResultSchema, data);
export const parseBulkResult = (data: unknown): BulkTransferResult => parse(bulkResultSchema, data);
export const parseAdminChange = (data: unknown): AdminChange => parse(adminChangeSchema, data);

// --------------------------------------------------------------------------- erros

/**
 * Texto para o utilizador. A base manda o texto em português em `detail` (o PostgREST traz o
 * código em `message` e o texto em `details`): mostra-se esse; sem ele, a frase geral do código.
 * Nunca se mostra o código técnico.
 */
export const membershipErrorText = (error: unknown): string => {
  if (error instanceof SharingError) {
    const detail = error.detail?.trim();
    if (detail) return detail;
    return sharingErrorText(error);
  }
  return sharingErrorText(error);
};

/** O motivo de uma ficha que falhou numa mudança em massa. */
export const bulkItemError = (item: BulkItem): string =>
  membershipErrorText(new SharingError(item.error ?? 'unknown', item.detail ?? null));

// --------------------------------------------------------------------------- empresas de destino

/** As empresas que o utilizador administra (ou todas, se é Super Admin), por ordem de nome. */
export const manageableCompanies = (mine: readonly MyCompany[]): MyCompany[] =>
  sortCompanies(mine.filter(company => managesCompany(company.role)));

export const canManageCompany = (mine: readonly MyCompany[], companyId: string): boolean =>
  mine.some(company => company.company_id === companyId && managesCompany(company.role));

/** A empresa de origem, se todas as fichas estão na mesma; senão null. */
export const commonOrigin = (employees: readonly { company_id: string }[]): string | null => {
  const first = employees[0]?.company_id;
  if (!first) return null;
  return employees.every(employee => employee.company_id === first) ? first : null;
};

/** Destinos possíveis: as empresas que se administra, sem a empresa atual das fichas. */
export const transferTargets = (
  mine: readonly MyCompany[],
  employees: readonly { company_id: string }[]
): MyCompany[] => {
  const origin = commonOrigin(employees);
  return manageableCompanies(mine).filter(company => company.company_id !== origin);
};

// --------------------------------------------------------------------------- fichas movíveis

export interface MovableEmployee {
  id: string;
  name: string;
  company_id: string;
  user_id: string | null;
  is_active: boolean;
}

export type SkipReason = 'not_managed' | 'inactive' | 'no_account';

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  not_managed: 'não administra a empresa atual',
  inactive: 'a ficha está inativa',
  no_account: 'ainda não tem conta de utilizador',
};

/**
 * Separa as fichas que se podem mover das que a base recusaria à partida: empresa atual que
 * o utilizador não administra, ficha inativa ou sem conta.
 */
export const splitMovable = <T extends MovableEmployee>(
  employees: readonly T[],
  mine: readonly MyCompany[]
): { movable: T[]; skipped: { employee: T; reason: SkipReason }[] } => {
  const movable: T[] = [];
  const skipped: { employee: T; reason: SkipReason }[] = [];
  for (const employee of employees) {
    if (!canManageCompany(mine, employee.company_id))
      skipped.push({ employee, reason: 'not_managed' });
    else if (!employee.is_active) skipped.push({ employee, reason: 'inactive' });
    else if (!employee.user_id) skipped.push({ employee, reason: 'no_account' });
    else movable.push(employee);
  }
  return { movable, skipped };
};

/** O botão "Mover para empresa…" só aparece se a empresa atual é administrada e há destino. */
export const canOfferMove = (
  mine: readonly MyCompany[],
  employee: { company_id: string }
): boolean =>
  canManageCompany(mine, employee.company_id) && transferTargets(mine, [employee]).length > 0;

// --------------------------------------------------------------------------- resumo do que fica por tratar

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const EFFECT_TEXT: Record<keyof PendingEffects, (n: number) => string> = {
  tasks_open_assigned: n => plural(n, 'tarefa aberta atribuída', 'tarefas abertas atribuídas'),
  tasks_open_participant: n =>
    plural(n, 'tarefa aberta em que participa', 'tarefas abertas em que participa'),
  events_future_attending: n =>
    plural(n, 'evento futuro a que está convidado(a)', 'eventos futuros a que está convidado(a)'),
  events_future_owned: n => plural(n, 'evento futuro que organiza', 'eventos futuros que organiza'),
  folders_assigned: n => plural(n, 'pasta atribuída', 'pastas atribuídas'),
  chat_conversations_origin: n =>
    plural(n, 'conversa da empresa anterior (fica lá)', 'conversas da empresa anterior (ficam lá)'),
};

const EFFECT_ORDER = Object.keys(EFFECT_TEXT) as (keyof PendingEffects)[];

export interface PendingEffectLine {
  key: keyof PendingEffects;
  count: number;
  text: string;
}

/** Só as linhas com algo por rever, por ordem fixa e em português. */
export const describePendingEffects = (effects: PendingEffects): PendingEffectLine[] =>
  EFFECT_ORDER.filter(key => effects[key] > 0).map(key => ({
    key,
    count: effects[key],
    text: EFFECT_TEXT[key](effects[key]),
  }));

/** Soma os efeitos de várias fichas (mudança em massa). */
export const sumPendingEffects = (items: readonly BulkItem[]): PendingEffects => {
  const total = Object.fromEntries(EFFECT_ORDER.map(key => [key, 0])) as PendingEffects;
  for (const item of items) {
    if (!item.ok || !item.result) continue;
    for (const key of EFFECT_ORDER) total[key] += item.result.pending_effects[key];
  }
  return total;
};

/** "2 movidos" / "2 movidos, 1 com erro" / "1 com erro". */
export const bulkSummaryText = (result: Pick<BulkTransferResult, 'ok' | 'failed'>): string => {
  const parts: string[] = [];
  if (result.ok > 0) parts.push(plural(result.ok, 'colaborador movido', 'colaboradores movidos'));
  if (result.failed > 0) parts.push(plural(result.failed, 'com erro', 'com erro'));
  return parts.join(', ') || 'Nada foi movido';
};

// --------------------------------------------------------------------------- administradores

export const ADMIN_ROLE_OPTIONS: { value: AdminRole; label: string; hint: string }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    hint: 'Gere a empresa, os colaboradores e os outros administradores.',
  },
  {
    value: 'gestor',
    label: 'Gestor',
    hint: 'Vê e trata de pedidos da empresa, sem a administrar.',
  },
];

/** Quem vem da equipa da plataforma não se retira aqui: é gerido pela administração da plataforma. */
export const canRemoveViewer = (viewer: CompanyViewer): boolean => viewer.kind !== 'super_admin';

export const adminCount = (viewers: readonly CompanyViewer[]): number =>
  viewers.filter(viewer => viewer.kind === 'admin_empresa').length;

/** É o único administrador da empresa: a base recusa retirá-lo (a empresa nunca fica sem). */
export const isLastAdmin = (viewers: readonly CompanyViewer[], viewer: CompanyViewer): boolean =>
  viewer.kind === 'admin_empresa' && adminCount(viewers) <= 1;

export const LAST_ADMIN_RULE =
  'Uma empresa tem de ter sempre pelo menos um administrador. Para retirar o último, adicione primeiro outro.';

export const viewerRoleText = (viewer: CompanyViewer): string => viewerKindLabel(viewer.kind);

export interface AdminCandidate {
  userId: string;
  name: string;
  email: string;
}

export interface CandidateSource {
  name: string;
  email: string;
  user_id: string | null;
  is_active: boolean;
}

/**
 * Quem se pode propor como administrador ou gestor: os colaboradores ativos da empresa que têm
 * conta e ainda não figuram na lista (nem como administrador, gestor ou equipa da plataforma).
 */
export const adminCandidates = (
  employees: readonly CandidateSource[],
  viewers: readonly CompanyViewer[]
): AdminCandidate[] => {
  const taken = new Set(viewers.map(viewer => viewer.user_id));
  const byUser = new Map<string, AdminCandidate>();
  for (const employee of employees) {
    if (!employee.is_active || !employee.user_id || taken.has(employee.user_id)) continue;
    if (!byUser.has(employee.user_id))
      byUser.set(employee.user_id, {
        userId: employee.user_id,
        name: employee.name,
        email: employee.email,
      });
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};
