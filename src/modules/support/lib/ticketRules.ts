// Regras dos tickets de suporte do colaborador (as mesmas da página antiga).

export type TicketFilter = 'all' | 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  department_id: string | null;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  created_at?: string;
  /** Quem enviou (o colaborador ou um admin). */
  uploaded_by?: string;
}

export interface TicketReply {
  id: string;
  message: string;
  sender_role: string;
  created_at: string;
  user_id: string;
}

export const TICKET_FILTERS: { value: TicketFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abertos' },
  { value: 'in_progress', label: 'Em progresso' },
  { value: 'resolved', label: 'Resolvidos' },
];

export const TICKET_STATUS: Record<string, { label: string; chip: string }> = {
  open: { label: 'Em aberto', chip: 'bg-sky-100 text-sky-800' },
  in_progress: { label: 'Em progresso', chip: 'bg-amber-100 text-amber-800' },
  resolved: { label: 'Resolvido', chip: 'bg-emerald-100 text-emerald-800' },
  closed: { label: 'Fechado', chip: 'bg-slate-200 text-slate-700' },
};

export const TICKET_PRIORITY: Record<string, { label: string; chip: string }> = {
  low: { label: 'Baixa', chip: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Média', chip: 'bg-blue-100 text-blue-800' },
  high: { label: 'Alta', chip: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgente', chip: 'bg-rose-100 text-rose-700' },
};

/** "Resolvidos" junta resolvidos e fechados. */
const inFilter = (ticket: SupportTicket, filter: TicketFilter): boolean => {
  if (filter === 'open') return ticket.status === 'open';
  if (filter === 'in_progress') return ticket.status === 'in_progress';
  if (filter === 'resolved') return ticket.status === 'resolved' || ticket.status === 'closed';
  return true;
};

export const filterTickets = (tickets: SupportTicket[], filter: TicketFilter) =>
  tickets.filter(ticket => inFilter(ticket, filter));

export const countTickets = (tickets: SupportTicket[]): Record<TicketFilter, number> => ({
  all: tickets.length,
  open: filterTickets(tickets, 'open').length,
  in_progress: filterTickets(tickets, 'in_progress').length,
  resolved: filterTickets(tickets, 'resolved').length,
});

/** Resolvido ou fechado: já não aceita respostas do colaborador. */
export const isTicketClosed = (ticket: Pick<SupportTicket, 'status'>): boolean =>
  ticket.status === 'closed' || ticket.status === 'resolved';
