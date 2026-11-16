// Dados de um ticket de suporte para os emails de aviso: quem é o dono, para onde vai o email e
// se o utilizador que pede pode mesmo mandar este aviso. Tudo lido da base de dados; nada do que
// vem no pedido decide o destinatário. Só Deno (cliente service role).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isRecent } from './guard.ts';

export interface TicketRow {
  id: string;
  subject: string;
  message: string | null;
  priority: string | null;
  status: string | null;
  department_id: string | null;
  employee_id: string | null;
  company_id: string | null;
  requester_user_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface TicketParty {
  /** Quem abriu o ticket (colaborador ou cliente de fora). */
  name: string;
  email: string | null;
  companyName: string;
  /** Contas (auth) do dono: a do colaborador, a de admin ligada à ficha, ou a do cliente de fora. */
  userIds: string[];
}

const COLUMNS =
  'id, subject, message, priority, status, department_id, employee_id, company_id, requester_user_id, requester_name, requester_email, admin_notes, created_at';

export const loadTicket = async (
  db: SupabaseClient,
  ticketId: string
): Promise<TicketRow | null> => {
  const { data } = await db
    .from('support_tickets')
    .select(COLUMNS)
    .eq('id', ticketId)
    .maybeSingle();
  return (data as TicketRow | null) ?? null;
};

/** O dono do ticket: nome, email, empresa e conta, pelos dados da base. */
export const ticketParty = async (db: SupabaseClient, ticket: TicketRow): Promise<TicketParty> => {
  const [employee, company] = await Promise.all([
    ticket.employee_id
      ? db
          .from('employees')
          .select('name, email, user_id, admin_user_id')
          .eq('id', ticket.employee_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ticket.company_id
      ? db.from('companies').select('name').eq('id', ticket.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const emp = employee.data as {
    name: string | null;
    email: string | null;
    user_id: string | null;
    admin_user_id: string | null;
  } | null;
  return {
    name: emp?.name?.trim() || ticket.requester_name?.trim() || 'Cliente',
    email: emp?.email?.trim() || ticket.requester_email?.trim() || null,
    companyName: ((company.data as { name: string | null } | null)?.name ?? '').trim(),
    userIds: [emp?.user_id, emp?.admin_user_id, ticket.requester_user_id].filter(
      (id): id is string => !!id
    ),
  };
};

/**
 * O ticket que esta pessoa acabou de abrir (mesmo assunto e departamento, nos últimos 15 minutos).
 * Só assim o aviso aos RH de um ticket novo é enviado: o conteúdo vem do ticket, não do pedido.
 */
export const findRecentOwnTicket = async (
  db: SupabaseClient,
  userId: string,
  departmentId: string | null | undefined,
  subject: string
): Promise<{ ticket: TicketRow; party: TicketParty } | null> => {
  const base = db.from('support_tickets').select(COLUMNS).eq('subject', subject);
  const { data } = await (
    departmentId ? base.eq('department_id', departmentId) : base.is('department_id', null)
  )
    .order('created_at', { ascending: false })
    .limit(5);
  for (const ticket of (data ?? []) as TicketRow[]) {
    if (!isRecent(ticket.created_at)) continue;
    const party = await ticketParty(db, ticket);
    if (party.userIds.includes(userId)) return { ticket, party };
  }
  return null;
};

/**
 * Quem pede pode tratar este ticket (administrador ou equipa do departamento)? A pergunta vai à
 * base com a sessão da própria pessoa (a função rz_can_handle_ticket usa auth.uid()).
 */
export const canHandleTicket = async (req: Request, ticketId: string): Promise<boolean> => {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !anon || !authorization) return false;
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asUser.rpc('rz_can_handle_ticket', { p_ticket: ticketId });
  return !error && data === true;
};
