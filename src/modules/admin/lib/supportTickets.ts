// Suporte (admin): estados, "à espera de resposta", filtros e a impressão (com o texto escapado).
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { matchesText } from '@/lib/text';
import type { SupportTicket } from '@/hooks/useAdminTickets';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/** Três estados para quem trabalha os tickets; "Fechado" (antigo) conta como resolvido. */
export interface ConversationFile {
  id: string;
  uploaded_by?: string;
  created_at?: string;
}

export interface ConversationBubble<F extends ConversationFile> {
  key: string;
  fromEmployee: boolean;
  text: string;
  at: string | null;
  files: F[];
}

/** Anexos até 2 minutos depois de uma mensagem do mesmo lado ficam juntos dela. */
const SAME_MOMENT_MS = 2 * 60_000;

/**
 * Pedido, nota antiga, respostas e anexos por ordem. Um anexo é do suporte quando quem o
 * enviou respondeu como admin neste ticket; os restantes são do colaborador.
 */
export const conversationBubbles = <F extends ConversationFile>(
  first: { text: string; at: string },
  legacyNote: string | null,
  replies: {
    id: string;
    user_id: string | null;
    sender_role: string;
    message: string;
    created_at: string;
  }[],
  files: F[]
): ConversationBubble<F>[] => {
  const admins = new Set(replies.filter(r => r.sender_role !== 'employee').map(r => r.user_id));
  const bubbles: ConversationBubble<F>[] = [
    { key: 'first', fromEmployee: true, text: first.text, at: first.at, files: [] },
    ...(legacyNote
      ? [{ key: 'legacy', fromEmployee: false, text: legacyNote, at: null, files: [] }]
      : []),
    ...replies.map(reply => ({
      key: reply.id,
      fromEmployee: reply.sender_role === 'employee',
      text: reply.message,
      at: reply.created_at,
      files: [] as F[],
    })),
  ];
  const time = (at: string | null) => new Date(at ?? first.at).getTime();
  for (const file of files) {
    const at = file.created_at ?? first.at;
    const fromEmployee = !admins.has(file.uploaded_by ?? null);
    const near = bubbles.find(
      b => b.fromEmployee === fromEmployee && Math.abs(time(b.at) - time(at)) < SAME_MOMENT_MS
    );
    if (near) near.files.push(file);
    else bubbles.push({ key: `file-${file.id}`, fromEmployee, text: '', at, files: [file] });
  }
  // A nota antiga (sem data) fica logo a seguir ao pedido.
  const rank = (b: ConversationBubble<F>) => (b.key === 'first' ? 0 : b.key === 'legacy' ? 1 : 2);
  return bubbles.sort((a, b) => rank(a) - rank(b) || time(a.at) - time(b.at));
};

export const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em curso' },
  { value: 'resolved', label: 'Resolvido' },
];

export const statusLabel = (status: string): string =>
  status === 'closed'
    ? 'Resolvido'
    : (STATUS_OPTIONS.find(option => option.value === status)?.label ?? status);

export const isDone = (status: string) => status === 'resolved' || status === 'closed';

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Uma resposta da conversa (só o necessário para a lista). */
export interface ReplyMark {
  ticket_id: string;
  sender_role: string;
  created_at: string;
}

export interface TicketActivity {
  /** A última palavra é do colaborador e o ticket não está resolvido. */
  awaiting: boolean;
  lastActivityAt: string;
  /** Dias desde a última mensagem do colaborador por responder (0 se respondido). */
  waitingDays: number;
}

const DAY_MS = 24 * 3600 * 1000;

export const ticketActivity = (
  ticket: Pick<SupportTicket, 'status' | 'created_at' | 'updated_at' | 'admin_notes'>,
  replies: ReplyMark[],
  now = Date.now()
): TicketActivity => {
  let lastEmployee = ticket.created_at;
  // As notas antigas ("Notas do Admin") eram a resposta ao colaborador.
  let lastAdmin: string | null = ticket.admin_notes ? ticket.updated_at : null;
  for (const reply of replies) {
    if (reply.sender_role === 'employee') {
      if (reply.created_at > lastEmployee) lastEmployee = reply.created_at;
    } else if (!lastAdmin || reply.created_at > lastAdmin) {
      lastAdmin = reply.created_at;
    }
  }
  const awaiting = !isDone(ticket.status) && (!lastAdmin || lastEmployee > lastAdmin);
  const lastActivityAt = lastAdmin && lastAdmin > lastEmployee ? lastAdmin : lastEmployee;
  return {
    awaiting,
    lastActivityAt,
    waitingDays: awaiting ? Math.floor((now - new Date(lastEmployee).getTime()) / DAY_MS) : 0,
  };
};

export type QueueFilter = 'awaiting' | 'active' | 'done' | 'all';

export interface TicketFilters {
  queue: QueueFilter;
  search: string;
  priority: string;
  departmentId: string;
}

export const filterTickets = (
  tickets: SupportTicket[],
  filters: TicketFilters,
  activityOf: (ticket: SupportTicket) => TicketActivity
): SupportTicket[] =>
  tickets
    .filter(ticket => {
      const activity = activityOf(ticket);
      if (filters.queue === 'awaiting' && !activity.awaiting) return false;
      if (filters.queue === 'active' && isDone(ticket.status)) return false;
      if (filters.queue === 'done' && !isDone(ticket.status)) return false;
      if (filters.priority !== 'all' && ticket.priority !== filters.priority) return false;
      if (filters.departmentId !== 'all' && ticket.department_id !== filters.departmentId)
        return false;
      return matchesText(
        filters.search.trim(),
        ticket.subject,
        ticket.message,
        ticket.employees?.name,
        ticket.companies?.name
      );
    })
    // À espera primeiro (os mais antigos no topo), depois a atividade mais recente.
    .sort((a, b) => {
      const x = activityOf(a);
      const y = activityOf(b);
      if (x.awaiting !== y.awaiting) return x.awaiting ? -1 : 1;
      if (x.awaiting) {
        const urgency = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        return urgency || y.waitingDays - x.waitingDays;
      }
      return y.lastActivityAt.localeCompare(x.lastActivityAt);
    });

export const escapeHtml = (text: string | null | undefined): string =>
  (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface PrintReply {
  sender_role: string;
  message: string;
  created_at: string;
}

/** Corpo da impressão de um ticket: tudo o que vem do colaborador vai escapado (sem HTML). */
export const ticketPrintHtml = (
  ticket: SupportTicket,
  replies: PrintReply[],
  departmentName: string | null
): string => {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 8px;font-weight:600;width:140px;border:1px solid #ddd;background:#f5f5f5;">${label}</td><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`;
  const when = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: pt });
  const conversation = replies
    .map(
      reply =>
        `<div style="margin-top:8px;padding:8px;border:1px solid #eee;border-radius:4px;background:${reply.sender_role === 'employee' ? '#f9f9f9' : '#eef4ff'}"><p style="margin:0 0 4px;font-size:12px;color:#555;">${reply.sender_role === 'employee' ? 'Colaborador' : 'Suporte'} · ${when(reply.created_at)}</p><p style="margin:0;font-size:13px;white-space:pre-wrap;">${escapeHtml(reply.message)}</p></div>`
    )
    .join('');
  return `<div style="margin-bottom:20px;">
  <h2 style="margin:0 0 4px 0;font-size:18px;">${escapeHtml(ticket.subject)}</h2>
  <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">
    ${row('Colaborador', ticket.employees?.name ?? '-')}
    ${row('Empresa', ticket.companies?.name ?? '-')}
    ${departmentName ? row('Departamento', departmentName) : ''}
    ${row('Prioridade', PRIORITY_LABELS[ticket.priority] ?? ticket.priority)}
    ${row('Estado', statusLabel(ticket.status))}
    ${row('Data', when(ticket.created_at))}
  </table>
  <p style="font-weight:600;font-size:13px;margin:12px 0 4px 0;">Mensagem:</p>
  <p style="font-size:13px;white-space:pre-wrap;margin:0;padding:8px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;">${escapeHtml(ticket.message)}</p>
  ${conversation ? `<p style="font-weight:600;font-size:13px;margin:12px 0 0 0;">Conversa:</p>${conversation}` : ''}
</div>`;
};
