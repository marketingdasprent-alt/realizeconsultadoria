// Partilha entre empresas: as chamadas `rz_*` do contrato (docs/multiempresa/CONTRATO.md, 2.5).
// As funções e tabelas novas ainda não estão em integrations/supabase/types.ts (a migração 2 da
// Fase 0 não foi aplicada); por isso o cliente é tratado como "solto" até os tipos serem gerados.
import { supabase } from '@/integrations/supabase/client';
import {
  SharingError,
  toSharingError,
  type Capability,
  type CompanyViewer,
  type GroupMember,
  type GroupOverviewRow,
  type MyCompany,
  type RequestDirection,
  type Share,
  type ShareCode,
  type ShareRequest,
} from '../lib/sharing';

interface LooseResult {
  data: unknown;
  error: { message?: string; details?: string | null; code?: string } | null;
}

interface LooseClient {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<LooseResult>;
  from: (table: string) => {
    select: (columns: string) => { order: (column: string) => PromiseLike<LooseResult> };
  };
}

const client = supabase as unknown as LooseClient;

const call = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw toSharingError(error);
  return data as T;
};

const list = <T>(rows: T[] | null): T[] => rows ?? [];

const normalizeRequest = (row: ShareRequest): ShareRequest => ({
  ...row,
  ask: row.ask ?? [],
  offer: row.offer ?? [],
});

export interface ProposedShare {
  ask: string[];
  offer: string[];
}

export const sharingService = {
  /** Empresas a que o utilizador pertence (seletor de empresa). */
  myCompanies: async (): Promise<MyCompany[]> =>
    list(await call<MyCompany[] | null>('rz_my_companies')),

  /** Permissões que existem e quais se podem partilhar. */
  capabilities: async (): Promise<Capability[]> => {
    const { data, error } = await client
      .from('capability_catalog')
      .select('capability, module, kind, grantable, sensitive, min_role, description')
      .order('capability');
    if (error) throw toSharingError(error);
    return list(data as Capability[] | null);
  },

  /** Quem pode ver os dados da empresa (administradores, gestores e a equipa da plataforma). */
  companyViewers: async (company: string): Promise<CompanyViewer[]> =>
    list(await call<CompanyViewer[] | null>('rz_company_viewers', { p_company: company })),

  getShareCode: (company: string) => call<ShareCode>('rz_get_share_code', { p_company: company }),

  rotateShareCode: (company: string) =>
    call<ShareCode>('rz_rotate_share_code', { p_company: company }),

  /** Responde sempre `submitted: true`, com código certo ou errado (não revela empresas). */
  requestShare: (company: string, code: string, proposed: ProposedShare) =>
    call<{ submitted: boolean }>('rz_request_share', {
      p_company: company,
      p_code: code,
      p_proposed: proposed,
    }),

  listRequests: async (company: string, direction: RequestDirection): Promise<ShareRequest[]> =>
    list(
      await call<ShareRequest[] | null>('rz_list_requests', {
        p_company: company,
        p_direction: direction,
      })
    ).map(normalizeRequest),

  cancelRequest: (request: string) =>
    call<{ status: 'cancelado' }>('rz_cancel_request', { p_request: request }),

  approveRequest: (request: string, grant: string[]) =>
    call<{ status: 'aprovado'; group_id: string; share_ids: string[] }>('rz_approve_share', {
      p_request: request,
      p_grant: grant,
    }),

  rejectRequest: (request: string, note: string | null) =>
    call<{ status: 'recusado' }>('rz_reject_request', { p_request: request, p_note: note }),

  listShares: async (company: string, includeRevoked = false): Promise<Share[]> =>
    list(
      await call<Share[] | null>('rz_list_shares', {
        p_company: company,
        p_include_revoked: includeRevoked,
      })
    ),

  /** O dono define o conjunto completo que a outra empresa passa a ter. */
  setShares: (company: string, other: string, capabilities: string[]) =>
    call<{ added: string[]; removed: string[] }>('rz_set_shares', {
      p_company: company,
      p_other: other,
      p_capabilities: capabilities,
    }),

  revokeShare: (company: string, share: string, reason: string | null) =>
    call<{ status: 'revogado' }>('rz_revoke_share', {
      p_company: company,
      p_share: share,
      p_reason: reason,
    }),

  confirmLegacyShare: (company: string, share: string) =>
    call<{ legacy_confirmed_at: string }>('rz_confirm_legacy_share', {
      p_company: company,
      p_share: share,
    }),

  listGroup: async (company: string): Promise<GroupMember[]> =>
    list(await call<GroupMember[] | null>('rz_list_group', { p_company: company })).map(row => ({
      ...row,
      default_capabilities: row.default_capabilities ?? [],
    })),

  /** Todos os grupos e as suas empresas (só Super Admin). */
  listAllGroups: async (): Promise<GroupOverviewRow[]> =>
    list(await call<GroupOverviewRow[] | null>('rz_list_groups')).map(row => ({
      ...row,
      default_capabilities: row.default_capabilities ?? [],
    })),

  // Gestão de grupos: só Super Admin, com a palavra-passe confirmada há pouco (reauth_required).
  createGroup: (name: string, companies: string[], capabilities: string[]) =>
    call<{ group_id: string }>('rz_create_group', {
      p_name: name,
      p_companies: companies,
      p_capabilities: capabilities,
    }),

  renameGroup: (group: string, name: string) =>
    call<{ group_id: string; name: string }>('rz_rename_group', { p_group: group, p_name: name }),

  /** Define o conjunto completo de empresas; as retiradas perdem as partilhas com as outras do grupo. */
  setGroupMembers: (group: string, companies: string[]) =>
    call<{ group_id: string; added: number; removed: number; revoked: number }>(
      'rz_set_group_members',
      { p_group: group, p_companies: companies }
    ),

  setGroupCapabilities: (group: string, capabilities: string[]) =>
    call<{ group_id: string; capabilities: string[] }>('rz_set_group_capabilities', {
      p_group: group,
      p_capabilities: capabilities,
    }),

  dissolveGroup: (group: string) =>
    call<{ group_id: string; revoked: number }>('rz_dissolve_group', { p_group: group }),

  leaveGroup: (company: string) =>
    call<{ revoked: number }>('rz_leave_group', { p_company: company }),

  /** Repete a sessão com a palavra-passe: as capacidades sensíveis pedem login recente. */
  reauthenticate: async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new SharingError('reauth_failed');
  },
};
