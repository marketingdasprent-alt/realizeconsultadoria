import { describe, expect, it } from 'vitest';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import {
  conversationBubbles,
  escapeHtml,
  filterTickets,
  statusLabel,
  ticketActivity,
  ticketPrintHtml,
  type ReplyMark,
} from '../supportTickets';

const now = new Date('2026-10-23T12:00:00Z').getTime();

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: 't1',
  subject: 'Férias',
  message: 'Posso trocar as férias?',
  priority: 'medium',
  status: 'open',
  created_at: '2026-10-10T09:00:00Z',
  updated_at: '2026-10-10T09:00:00Z',
  resolved_at: null,
  admin_notes: null,
  employee_id: 'e1',
  company_id: 'c1',
  department_id: 'd1',
  employees: { name: 'Ana Ferreira', email: 'ana@x.pt' },
  companies: { name: 'DASP' },
  ...over,
});

const reply = (role: string, at: string): ReplyMark => ({
  ticket_id: 't1',
  sender_role: role,
  created_at: at,
});

describe('ticketActivity', () => {
  it('a new ticket nobody answered is awaiting, counting days', () => {
    const activity = ticketActivity(ticket(), [], now);
    expect(activity.awaiting).toBe(true);
    expect(activity.waitingDays).toBe(13);
  });

  it('answered by support is no longer awaiting, until the employee writes again', () => {
    expect(ticketActivity(ticket(), [reply('admin', '2026-10-11T10:00:00Z')], now).awaiting).toBe(
      false
    );
    expect(
      ticketActivity(
        ticket(),
        [reply('admin', '2026-10-11T10:00:00Z'), reply('employee', '2026-10-20T10:00:00Z')],
        now
      ).awaiting
    ).toBe(true);
  });

  it('old admin notes count as an answer; resolved tickets never wait', () => {
    expect(
      ticketActivity(
        ticket({ admin_notes: 'Tratado', updated_at: '2026-10-12T00:00:00Z' }),
        [],
        now
      ).awaiting
    ).toBe(false);
    expect(ticketActivity(ticket({ status: 'closed' }), [], now).awaiting).toBe(false);
  });
});

describe('filterTickets', () => {
  const tickets = [
    ticket({ id: 'a', subject: 'Cartão', message: 'Perdi o cartão', status: 'resolved' }),
    ticket({ id: 'b', subject: 'Recibo', message: 'Falta o recibo', priority: 'high' }),
    ticket({ id: 'c', subject: 'Férias', created_at: '2026-09-01T00:00:00Z' }),
  ];
  const activityOf = (t: SupportTicket) => ticketActivity(t, [], now);
  const base = { queue: 'all' as const, search: '', priority: 'all', departmentId: 'all' };

  it('awaiting first, by priority then oldest', () => {
    expect(filterTickets(tickets, base, activityOf).map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by queue and searches without accents', () => {
    expect(filterTickets(tickets, { ...base, queue: 'done' }, activityOf).map(t => t.id)).toEqual([
      'a',
    ]);
    expect(
      filterTickets(tickets, { ...base, search: 'ferias' }, activityOf).map(t => t.id)
    ).toEqual(['c']);
  });
});

describe('impressão', () => {
  it('escapes everything the employee wrote', () => {
    const html = ticketPrintHtml(
      ticket({ message: '<img src=x onerror="alert(1)">', subject: '<b>x</b>' }),
      [
        {
          sender_role: 'employee',
          message: '<script>x()</script>',
          created_at: '2026-10-10T10:00:00Z',
        },
      ],
      null
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('shows "Fechado" as resolved', () => {
    expect(statusLabel('closed')).toBe('Resolvido');
    expect(statusLabel('in_progress')).toBe('Em curso');
  });
});

describe('conversationBubbles', () => {
  const first = { text: 'Preciso de ajuda', at: '2026-10-20T10:00:00Z' };
  const replies = [
    {
      id: 'r1',
      user_id: 'admin-1',
      sender_role: 'admin',
      message: 'Segue o ficheiro',
      created_at: '2026-10-21T09:00:00Z',
    },
  ];

  it('puts files next to the message from the same side', () => {
    const bubbles = conversationBubbles(first, null, replies, [
      { id: 'f1', uploaded_by: 'emp-1', created_at: '2026-10-20T10:00:30Z' },
      { id: 'f2', uploaded_by: 'admin-1', created_at: '2026-10-21T08:59:50Z' },
    ]);
    expect(bubbles.map(b => [b.key, b.files.map(f => f.id)])).toEqual([
      ['first', ['f1']],
      ['r1', ['f2']],
    ]);
  });

  it('keeps a late file as its own bubble, in time order', () => {
    const bubbles = conversationBubbles(first, 'Nota antiga', replies, [
      { id: 'f3', uploaded_by: 'emp-1', created_at: '2026-10-22T15:00:00Z' },
    ]);
    expect(bubbles.map(b => [b.key, b.fromEmployee])).toEqual([
      ['first', true],
      ['legacy', false],
      ['r1', false],
      ['file-f3', true],
    ]);
  });
});
