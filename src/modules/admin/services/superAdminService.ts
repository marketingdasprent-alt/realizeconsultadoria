// Super administradores: quem são e quem pode passar a ser (rz_list_super_admins e companhia).
// Só um super admin lê; adicionar e retirar exigem sessão aal2 (código do autenticador) e uma
// confirmação recente, por isso o servidor pode responder mfa_required ou reauth_required.
import { supabase } from '@/integrations/supabase/client';
import { toSharingError } from '../lib/sharing';

export interface SuperAdmin {
  user_id: string;
  name: string;
  email: string;
  /** Desde quando é super admin. */
  since: string;
  /** Tem o segundo passo (autenticador) configurado. */
  mfa_enabled: boolean;
  added_by_name: string | null;
  is_self: boolean;
}

export interface SuperAdminCandidate {
  user_id: string;
  name: string;
  email: string;
  /** As empresas que já administra, separadas por vírgulas. */
  companies: string;
  mfa_enabled: boolean;
}

interface LooseClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{
    data: unknown;
    error: { message?: string; details?: string | null; code?: string } | null;
  }>;
}

const client = supabase as unknown as LooseClient;

const call = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw toSharingError(error);
  return data as T;
};

export const superAdminService = {
  list: async (): Promise<SuperAdmin[]> =>
    (await call<SuperAdmin[] | null>('rz_list_super_admins')) ?? [],

  candidates: async (): Promise<SuperAdminCandidate[]> =>
    (await call<SuperAdminCandidate[] | null>('rz_super_admin_candidates')) ?? [],

  add: async (userId: string): Promise<void> => {
    await call('rz_add_super_admin', { p_user: userId });
  },

  remove: async (userId: string): Promise<void> => {
    await call('rz_remove_super_admin', { p_user: userId });
  },
};
