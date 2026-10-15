import { describe, expect, it } from 'vitest';
import { countTickets, filterTickets, isTicketClosed, type SupportTicket } from '../ticketRules';

const ticket = (id: string, status: string): SupportTicket => ({
  id,
  subject: 'Assunto',
  message: 'Mensagem',
  priority: 'medium',
  status,
  created_at: '2026-10-15T10:00:00Z',
  admin_notes: null,
  department_id: null,
});

const tickets = [
  ticket('a', 'open'),
  ticket('b', 'in_progress'),
  ticket('c', 'resolved'),
  ticket('d', 'closed'),
];

describe('tickets do colaborador', () => {
  it('"Resolvidos" junta resolvidos e fechados', () => {
    expect(filterTickets(tickets, 'resolved').map(t => t.id)).toEqual(['c', 'd']);
  });

  it('contadores por separador', () => {
    expect(countTickets(tickets)).toEqual({ all: 4, open: 1, in_progress: 1, resolved: 2 });
  });

  it('resolvido ou fechado bloqueia novas respostas', () => {
    expect(isTicketClosed({ status: 'resolved' })).toBe(true);
    expect(isTicketClosed({ status: 'closed' })).toBe(true);
    expect(isTicketClosed({ status: 'open' })).toBe(false);
    expect(isTicketClosed({ status: 'in_progress' })).toBe(false);
  });
});
