// Tickets de exemplo (só na pré-visualização /dev/realize-2/tickets).
import type { SupportTicket, TicketAttachment, TicketReply } from './ticketRules';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const DEMO_TICKETS: SupportTicket[] = [
  {
    id: 't1',
    subject: 'Declaração de rendimentos',
    message: 'Bom dia, preciso da declaração de rendimentos de 2025 para o banco. Obrigada!',
    priority: 'medium',
    status: 'in_progress',
    created_at: hoursAgo(26),
    admin_notes: null,
    department_id: null,
  },
  {
    id: 't2',
    subject: 'Alteração de IBAN',
    message: 'Mudei de banco e queria atualizar o IBAN para o próximo processamento.',
    priority: 'high',
    status: 'open',
    created_at: hoursAgo(3),
    admin_notes: null,
    department_id: null,
  },
  {
    id: 't3',
    subject: 'Cartão refeição',
    message: 'O meu cartão refeição deixou de funcionar.',
    priority: 'low',
    status: 'resolved',
    created_at: hoursAgo(24 * 9),
    admin_notes: 'Novo cartão enviado por correio.',
    department_id: null,
  },
];

export const DEMO_ATTACHMENTS: Record<string, TicketAttachment[]> = {
  t2: [
    {
      id: 'att1',
      ticket_id: 't2',
      file_name: 'Comprovativo_IBAN.pdf',
      file_path: '',
      file_size: 182_000,
      content_type: 'application/pdf',
    },
  ],
};

export const DEMO_REPLIES: Record<string, TicketReply[]> = {
  t1: [
    {
      id: 'r1',
      message: 'Olá Joana! Já pedimos à contabilidade, deve ficar pronta amanhã.',
      sender_role: 'admin',
      created_at: hoursAgo(20),
      user_id: 'rh',
    },
    {
      id: 'r2',
      message: 'Perfeito, muito obrigada!',
      sender_role: 'employee',
      created_at: hoursAgo(19),
      user_id: 'me',
    },
  ],
};
