// Pedidos para eliminar nos Documentos (tabela file_delete_requests). Quem tem edição pede; os
// administradores recebem um aviso do Realize AI (user_notifications → push) e aprovam ou
// recusam no cartão da página do Realize AI. Só depois
// de aprovado é que se pede ao agente para mover para o lixo do servidor.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Onde o admin aprova: a página do Realize AI (cartões dos pedidos). */
export const REQUESTS_LINK = '/colaborador/ai';

export interface DeleteRequestRow {
  id: string;
  path: string;
  name: string;
  entry_type: 'file' | 'dir';
  requested_by: string;
  requester_name: string | null;
  status: 'pending' | 'rejected' | 'done' | 'failed';
  created_at: string;
}

/**
 * Pode aprovar/eliminar logo: administrador (papel admin ou grupo de admin ativo), pela conta
 * com que entrou ou pela conta de admin ligada à ficha (employees.admin_user_id) — nos
 * Documentos a pessoa está quase sempre com a conta de colaborador.
 */
export const canDeleteFiles = async (db: SupabaseClient, userId: string) => {
  const { data: linked } = await db
    .from('employees')
    .select('admin_user_id')
    .eq('user_id', userId)
    .not('admin_user_id', 'is', null);
  const ids = [userId, ...(linked ?? []).map(row => row.admin_user_id as string)];
  const [role, groups] = await Promise.all([
    db.from('user_roles').select('role').in('user_id', ids).eq('role', 'admin').limit(1),
    db
      .from('admin_group_members')
      .select('admin_groups!inner(is_active)')
      .in('user_id', ids)
      .eq('admin_groups.is_active', true)
      .limit(1),
  ]);
  return (role.data?.length ?? 0) > 0 || (groups.data?.length ?? 0) > 0;
};

/**
 * Quem recebe o aviso: papel admin e grupo "Super Admin", e a conta de colaborador ligada a
 * cada um (para o aviso aparecer na conta com que costumam entrar).
 */
const adminRecipients = async (db: SupabaseClient) => {
  const [roles, groups] = await Promise.all([
    db.from('user_roles').select('user_id').eq('role', 'admin'),
    db
      .from('admin_group_members')
      .select('user_id, admin_groups!inner(name, is_active)')
      .eq('admin_groups.is_active', true)
      .eq('admin_groups.name', 'Super Admin'),
  ]);
  const admins = new Set<string>([
    ...(roles.data ?? []).map(row => row.user_id as string),
    ...(groups.data ?? []).map(row => row.user_id as string),
  ]);
  if (!admins.size) return [];
  const { data: linked } = await db
    .from('employees')
    .select('user_id')
    .in('admin_user_id', [...admins])
    .not('user_id', 'is', null);
  (linked ?? []).forEach(row => admins.add(row.user_id as string));
  return [...admins];
};

const notify = async (
  db: SupabaseClient,
  userIds: string[],
  actorId: string,
  title: string,
  body: string,
  link: string
) => {
  const rows = userIds
    .filter(id => id && id !== actorId)
    .map(user_id => ({
      user_id,
      kind: 'assistant',
      title: title.slice(0, 200),
      body: body.slice(0, 300),
      link,
      actor_id: actorId,
    }));
  if (!rows.length) return;
  const { error } = await db.from('user_notifications').insert(rows);
  if (error) console.error('company-files: aviso falhou', error.message);
};

/** Novo pedido (ou o pendente que já existe para o mesmo caminho). */
export const requestDelete = async (
  db: SupabaseClient,
  input: { userId: string; userName: string; path: string; name: string; type: 'file' | 'dir' }
) => {
  const { error } = await db.from('file_delete_requests').insert({
    path: input.path,
    name: input.name,
    entry_type: input.type,
    requested_by: input.userId,
    requester_name: input.userName,
  });
  // 23505 = já há um pedido pendente para este caminho: não se avisa outra vez
  if (error?.code === '23505') return;
  if (error) throw error;
  await notify(
    db,
    await adminRecipients(db),
    input.userId,
    'Pedido para eliminar',
    `${input.userName} quer eliminar ${input.type === 'dir' ? 'a pasta' : 'o ficheiro'} ${input.path}. Aprove ou recuse no Realize AI.`,
    REQUESTS_LINK
  );
};

export const pendingRequests = async (db: SupabaseClient) => {
  const { data, error } = await db
    .from('file_delete_requests')
    .select('id, path, name, entry_type, requested_by, requester_name, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as DeleteRequestRow[];
};

/**
 * Aprovar (move para o lixo com `trash`) ou recusar; avisa quem pediu. Devolve a mensagem de
 * erro do agente, se a eliminação falhar.
 */
export const decideRequest = async (
  db: SupabaseClient,
  input: {
    id: string;
    approve: boolean;
    deciderId: string;
    trash: (path: string) => Promise<string | null>;
  }
): Promise<{ error: string | null }> => {
  const { data: request } = await db
    .from('file_delete_requests')
    .select('id, path, name, entry_type, requested_by, status')
    .eq('id', input.id)
    .maybeSingle();
  if (!request || request.status !== 'pending') return { error: 'Este pedido já foi tratado.' };

  const decided = { decided_by: input.deciderId, decided_at: new Date().toISOString() };
  const what = request.entry_type === 'dir' ? 'pasta' : 'ficheiro';
  if (!input.approve) {
    await db
      .from('file_delete_requests')
      .update({ ...decided, status: 'rejected' })
      .eq('id', request.id);
    await notify(
      db,
      [request.requested_by],
      input.deciderId,
      `Pedido para eliminar recusado`,
      request.path,
      `/colaborador/documentos`
    );
    return { error: null };
  }

  try {
    const trashPath = await input.trash(request.path);
    await db
      .from('file_delete_requests')
      .update({ ...decided, status: 'done', trash_path: trashPath })
      .eq('id', request.id);
    await notify(
      db,
      [request.requested_by],
      input.deciderId,
      `Pedido aprovado: ${what} eliminad${what === 'pasta' ? 'a' : 'o'}`,
      request.path,
      `/colaborador/documentos`
    );
    return { error: null };
  } catch (err) {
    // Fica pendente (ex.: ficheiro aberto): o admin tenta outra vez mais tarde ou recusa.
    const message = err instanceof Error ? err.message : 'O servidor de ficheiros deu um erro.';
    await db.from('file_delete_requests').update({ error: message }).eq('id', request.id);
    return { error: message };
  }
};
