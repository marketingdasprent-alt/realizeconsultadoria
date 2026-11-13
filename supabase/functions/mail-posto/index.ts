// Edge function mail-posto: postos de email (Admin → Realize Mail → Postos). Um posto é uma conta
// interna só de email que vê as caixas dos Acessos que o admin escolher; quem abre o link do
// convite entra nele (função mail-login, ação 'posto') sem saber nenhuma palavra-passe.
//
// POST (sessão de administrador; verify_jwt = false, a sessão valida-se aqui):
//   { action: 'create', name, access_ids }              → cria o posto com essas caixas
//   { action: 'update', posto_id, name, access_ids }    → muda o nome e as caixas
//   { action: 'invite', posto_id }                      → link novo (invalida os anteriores)
//   { action: 'delete', posto_id }                      → apaga o posto e a sessão dele
// Respostas { ok: true, data } ou { ok: false, message }. As caixas que não ligaram (palavra-passe
// errada, servidor sem resposta…) vêm em data.problems; o posto fica gravado na mesma.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { isAdminAccount } from '../_shared/admin-account.ts';
import { MAIL_ERROR_MESSAGES, isMailError } from '../_shared/mail/errors.ts';
import {
  hashInviteToken,
  inviteExpiry,
  inviteLink,
  newInviteToken,
  parsePostoBoxes,
  parsePostoName,
} from '../_shared/mail/posto.ts';
import { isRecord, isUuid } from '../_shared/mail/request.ts';
import { corsHeaders, errorMessage, json, serviceClient } from '../_shared/mail-server/http.ts';
import { MAIL_APP_ORIGIN, mailAppUser } from '../_shared/mail-server/mailAppSession.ts';
import { shareAccessById } from '../mail-api/share.ts';

type Db = ReturnType<typeof serviceClient>;

const ok = (data: unknown) => json({ ok: true, data });
const fail = (message: string) => json({ ok: false, message });

const sessionUserId = async (req: Request, db: Db) => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await db.auth.getClaims(header.slice(7).trim());
  return error ? null : ((data?.claims?.sub as string | undefined) ?? null);
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Problem {
  accessId: string;
  email: string;
  message: string;
}

/** Só acessos de email com um endereço como utilizador (os mesmos que dão caixa no Webmail). */
const loadEmailAccesses = async (db: Db, ids: string[]) => {
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await db
    .from('accesses')
    .select('id, username, access_categories(name)')
    .in('id', ids);
  if (error) throw error;
  const found = new Map<string, string>();
  for (const row of (data ?? []) as unknown as {
    id: string;
    username: string;
    access_categories: { name: string } | null;
  }[]) {
    const email = row.username.trim().toLowerCase();
    if (EMAIL.test(email) && /email/i.test(row.access_categories?.name ?? ''))
      found.set(row.id, email);
  }
  return found;
};

/** Grava as caixas do posto e liga-as: as que já existem juntam o posto aos membros, as outras são criadas. */
const applyBoxes = async (db: Db, postoId: string, accessIds: string[]): Promise<Problem[]> => {
  const emails = await loadEmailAccesses(db, accessIds);
  const invalid = accessIds.filter(id => !emails.has(id));
  if (invalid.length) throw new Error('Há caixas que não são acessos de email.');

  const { data: current, error: currentError } = await db
    .from('mail_posto_boxes')
    .select('access_id')
    .eq('posto_id', postoId);
  if (currentError) throw currentError;
  const before = new Set((current ?? []).map(row => row.access_id as string));
  const removed = [...before].filter(id => !accessIds.includes(id));

  if (removed.length) {
    const { error } = await db
      .from('mail_posto_boxes')
      .delete()
      .eq('posto_id', postoId)
      .in('access_id', removed);
    if (error) throw error;
  }
  const added = accessIds.filter(id => !before.has(id));
  if (added.length) {
    const { error } = await db
      .from('mail_posto_boxes')
      .insert(added.map(access_id => ({ posto_id: postoId, access_id })));
    if (error) throw error;
  }

  // As caixas tiradas deixam de ter este posto como membro (a lista de quem deve ter a caixa já o exclui)
  for (const id of removed) {
    const { error } = await db.rpc('mail_sync_access_members', { p_access: id });
    if (error) throw error;
  }
  // Em paralelo: ligar uma caixa nova testa o login no servidor de email, e são até 20
  const results = await Promise.all(
    accessIds.map(async (id): Promise<Problem | null> => {
      try {
        const { data: account } = await db
          .from('mail_accounts')
          .select('id')
          .eq('access_id', id)
          .maybeSingle();
        if (account) {
          const { error } = await db.rpc('mail_sync_access_members', { p_access: id });
          if (error) throw error;
        } else {
          await shareAccessById(db, id);
        }
        return null;
      } catch (error) {
        console.error('mail-posto: caixa não ligada:', errorMessage(error));
        return {
          accessId: id,
          email: emails.get(id) ?? '',
          message:
            isMailError(error) && error.message
              ? error.message
              : MAIL_ERROR_MESSAGES.provider_error,
        };
      }
    })
  );
  return results.filter((problem): problem is Problem => problem !== null);
};

const loadPosto = async (db: Db, postoId: unknown) => {
  if (!isUuid(postoId)) return null;
  const { data } = await db
    .from('mail_postos')
    .select('id, name, user_id')
    .eq('id', postoId)
    .maybeSingle();
  return (data as { id: string; name: string; user_id: string } | null) ?? null;
};

const create = async (db: Db, adminId: string, body: Record<string, unknown>) => {
  const name = parsePostoName(body.name);
  if (!name) return fail('Dê um nome ao posto (até 80 caracteres).');
  const boxes = parsePostoBoxes(body.access_ids);
  if (!boxes) return fail('Escolha as caixas do posto (no máximo 20).');
  if (boxes.length === 0) return fail('Escolha pelo menos uma caixa para o posto.');

  const postoId = crypto.randomUUID();
  const userId = await mailAppUser(db, `posto:${postoId}`, name);
  // Esta conta é de um posto (a app mostra o nome do posto e só tem o Email)
  const { error: metaError } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { mail_only: true, mailbox: `posto:${postoId}`, posto: true },
  });
  const { error } = metaError
    ? { error: metaError }
    : await db
        .from('mail_postos')
        .insert({ id: postoId, name, user_id: userId, created_by: adminId });
  if (error) {
    await db.auth.admin.deleteUser(userId);
    throw error;
  }
  const problems = await applyBoxes(db, postoId, boxes);
  return ok({ id: postoId, problems });
};

const update = async (db: Db, body: Record<string, unknown>) => {
  const posto = await loadPosto(db, body.posto_id);
  if (!posto) return fail('Posto não encontrado.');
  const name = parsePostoName(body.name);
  if (!name) return fail('Dê um nome ao posto (até 80 caracteres).');
  const boxes = parsePostoBoxes(body.access_ids);
  if (!boxes) return fail('Escolha as caixas do posto (no máximo 20).');
  if (boxes.length === 0)
    return fail('O posto precisa de pelo menos uma caixa. Para o tirar, apague-o.');

  if (name !== posto.name) {
    const { error } = await db.from('mail_postos').update({ name }).eq('id', posto.id);
    if (error) throw error;
    await db.auth.admin.updateUserById(posto.user_id, { user_metadata: { name } });
  }
  return ok({ id: posto.id, problems: await applyBoxes(db, posto.id, boxes) });
};

const invite = async (db: Db, adminId: string, body: Record<string, unknown>) => {
  const posto = await loadPosto(db, body.posto_id);
  if (!posto) return fail('Posto não encontrado.');
  const { data: access } = await db
    .from('mail_app_users')
    .select('disabled_at')
    .eq('user_id', posto.user_id)
    .maybeSingle();
  if (access?.disabled_at)
    return fail('O posto está desligado. Religue-o antes de enviar um link.');
  const { count } = await db
    .from('mail_posto_boxes')
    .select('access_id', { count: 'exact', head: true })
    .eq('posto_id', posto.id);
  if (!count) return fail('O posto não tem caixas.');

  // Um link de cada vez: o novo anula os que ainda não foram usados
  const { error: clearError } = await db
    .from('mail_posto_invites')
    .delete()
    .eq('posto_id', posto.id)
    .is('used_at', null);
  if (clearError) throw clearError;
  const token = newInviteToken();
  const expiresAt = inviteExpiry();
  const { error } = await db.from('mail_posto_invites').insert({
    posto_id: posto.id,
    token_hash: await hashInviteToken(token),
    expires_at: expiresAt,
    created_by: adminId,
  });
  if (error) throw error;
  return ok({ link: inviteLink(MAIL_APP_ORIGIN, token), expiresAt });
};

const remove = async (db: Db, body: Record<string, unknown>) => {
  const posto = await loadPosto(db, body.posto_id);
  if (!posto) return fail('Posto não encontrado.');
  // Apagar a conta apaga as sessões, os membros das caixas, o posto, as caixas e os convites
  const { error } = await db.auth.admin.deleteUser(posto.user_id);
  if (error) throw error;
  return ok({ id: posto.id });
};

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Método não permitido.' }, 405);
  const db = serviceClient();
  const userId = await sessionUserId(req, db);
  if (!userId) return json({ ok: false, message: 'Não autorizado.' }, 401);
  if (!(await isAdminAccount(db, userId))) return fail('Só os administradores podem fazer isto.');

  const body: unknown = await req.json().catch(() => null);
  if (!isRecord(body)) return fail('Pedido inválido.');
  try {
    switch (body.action) {
      case 'create':
        return await create(db, userId, body);
      case 'update':
        return await update(db, body);
      case 'invite':
        return await invite(db, userId, body);
      case 'delete':
        return await remove(db, body);
      default:
        return fail('Pedido inválido.');
    }
  } catch (error) {
    console.error('mail-posto:', errorMessage(error));
    return fail('Erro no servidor. Tente outra vez.');
  }
});
