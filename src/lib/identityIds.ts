import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Contas unificadas (04/11): quem entra com a conta de colaborador conta também com a conta de
 * admin ligada à ficha. Os grupos de admin (admin_group_members) estão muitas vezes na conta
 * antiga, por isso as consultas por user_id usam todos estes ids (a BD decide: rz_identity_ids).
 */
export const identityIds = async (userId: string): Promise<string[]> => {
  const untyped: SupabaseClient = supabase;
  const { data } = await untyped.rpc('rz_identity_ids', { _user_id: userId });
  return Array.isArray(data) && data.length ? (data as string[]) : [userId];
};
