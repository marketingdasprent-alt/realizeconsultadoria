// Acessos de uma pessoa, dados por um administrador a partir do Workspace (menu de uma conversa
// privada): pastas da empresa (folder_assignments) e caixas de email partilhadas
// (employee_department_emails; a BD acerta os membros da caixa no Webmail).
//
// POST { action: 'overview', user_id }                         → ficha, pastas e caixas
// POST { action: 'folder-set', user_id, path, permission }     → dá (ou muda) o acesso a uma pasta
// POST { action: 'folder-remove', user_id, id }                → retira o acesso a uma pasta
// POST { action: 'mailbox-set', user_id, access_id, on }       → dá ou retira uma caixa de email
//
// verify_jwt = false: a sessão valida-se aqui e só administradores (isAdminAccount) passam.
// Respostas { ok: true, data } ou { ok: false, message }.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { isAdminAccount } from '../_shared/admin-account.ts';
import { cleanPath } from '../_shared/company-files.ts';
import { corsHeaders, json, serviceClient } from '../_shared/mail-server/http.ts';

type Db = ReturnType<typeof serviceClient>;

const ok = (data: unknown) => json({ ok: true, data });
const fail = (message: string) => json({ ok: false, message });
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const sessionUserId = async (req: Request, db: Db) => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await db.auth.getClaims(header.slice(7).trim());
  return error ? null : ((data?.claims?.sub as string | undefined) ?? null);
};

const overview = async (db: Db, employee: { id: string; name: string }) => {
  const [folders, shared, boxes] = await Promise.all([
    db
      .from('folder_assignments')
      .select('id, path, label, permission')
      .eq('employee_id', employee.id)
      .order('path'),
    db.from('employee_department_emails').select('access_id').eq('employee_id', employee.id),
    db
      .from('mail_accounts')
      .select('email, display_name, access_id')
      .not('access_id', 'is', null)
      .order('email'),
  ]);
  const assigned = new Set((shared.data ?? []).map(row => row.access_id as string));
  return {
    employee,
    folders: folders.data ?? [],
    mailboxes: (boxes.data ?? []).map(box => ({
      accessId: box.access_id as string,
      email: box.email as string,
      name: (box.display_name as string | null) ?? null,
      assigned: assigned.has(box.access_id as string),
    })),
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const db = serviceClient();
  const userId = await sessionUserId(req, db);
  if (!userId) return json({ error: 'Não autorizado' }, 401);
  if (!(await isAdminAccount(db, userId))) return fail('Só os administradores podem fazer isto.');

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isUuid(body.user_id)) return fail('Pessoa inválida.');
  const { data: employee } = await db
    .from('employees')
    .select('id, name')
    .eq('user_id', body.user_id)
    .maybeSingle();
  if (!employee) return fail('Esta pessoa não tem ficha de colaborador.');

  try {
    switch (body.action) {
      case 'overview':
        return ok(await overview(db, employee as { id: string; name: string }));
      case 'folder-set': {
        const path = cleanPath(body.path);
        if (!path) return fail('Caminho inválido.');
        if (body.permission !== 'read' && body.permission !== 'edit')
          return fail('Permissão inválida.');
        const { error } = await db
          .from('folder_assignments')
          .upsert(
            { employee_id: employee.id, path, permission: body.permission },
            { onConflict: 'employee_id,path' }
          );
        if (error) throw error;
        return ok({ path });
      }
      case 'folder-remove': {
        if (!isUuid(body.id)) return fail('Pasta inválida.');
        const { error } = await db
          .from('folder_assignments')
          .delete()
          .eq('id', body.id)
          .eq('employee_id', employee.id);
        if (error) throw error;
        return ok({ id: body.id });
      }
      case 'mailbox-set': {
        if (!isUuid(body.access_id)) return fail('Caixa inválida.');
        // Só caixas já ligadas ao Webmail (as outras ligam-se no admin, em Acessos)
        const { data: linked } = await db
          .from('mail_accounts')
          .select('id')
          .eq('access_id', body.access_id)
          .maybeSingle();
        if (!linked) return fail('Esta caixa ainda não está ligada ao Webmail.');
        if (body.on === true) {
          const { error } = await db
            .from('employee_department_emails')
            .insert({ employee_id: employee.id, access_id: body.access_id });
          // 23505: já a tinha
          if (error && error.code !== '23505') throw error;
        } else {
          const { error } = await db
            .from('employee_department_emails')
            .delete()
            .eq('employee_id', employee.id)
            .eq('access_id', body.access_id);
          if (error) throw error;
        }
        return ok({ accessId: body.access_id, on: body.on === true });
      }
      default:
        return fail('Ação desconhecida.');
    }
  } catch (error) {
    console.error('person-access:', error instanceof Error ? error.message : error);
    return fail('Não foi possível guardar. Tente outra vez.');
  }
});
