import { describe, expect, it } from 'vitest';
import { addTicketFiles, buildTimeline, replyWithFiles } from '../ticketFiles';
import type { SupportTicket, TicketAttachment } from '../ticketRules';

const file = (name: string, type = 'application/pdf', size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

const ticket: SupportTicket = {
  id: 't1',
  subject: 'IBAN',
  message: 'Mudei de banco',
  priority: 'high',
  status: 'open',
  created_at: '2026-10-15T08:00:00Z',
  admin_notes: null,
  department_id: null,
};

const attachment = (id: string, at: string, by = 'me'): TicketAttachment => ({
  id,
  ticket_id: 't1',
  file_name: `${id}.pdf`,
  file_path: `t1/${id}.pdf`,
  file_size: 1,
  content_type: 'application/pdf',
  created_at: at,
  uploaded_by: by,
});

describe('anexos dos tickets', () => {
  it('as mesmas regras do formulário antigo', () => {
    const { files, errors } = addTicketFiles(
      [],
      [
        file('a.pdf'),
        file('b.exe', 'application/x-msdownload'),
        file('c.png', 'image/png', 11 * 1024 * 1024),
      ]
    );
    expect(files.map(f => f.name)).toEqual(['a.pdf']);
    expect(errors).toHaveLength(2);
    const many = addTicketFiles(
      [],
      Array.from({ length: 7 }, (_, i) => file(`${i}.pdf`))
    );
    expect(many.files).toHaveLength(5);
  });

  it('a resposta indica os anexos (também no email aos RH)', () => {
    expect(replyWithFiles('  Segue  ', [file('recibo.pdf')])).toBe('Segue\n\n📎 recibo.pdf');
    expect(replyWithFiles('', [file('a.pdf'), file('b.pdf')])).toBe('📎 a.pdf, b.pdf');
  });

  it('linha do tempo: pedido, anexos do pedido, respostas e anexos pela ordem', () => {
    const timeline = buildTimeline(
      ticket,
      [
        attachment('pedido', '2026-10-15T08:00:05Z'),
        attachment('resposta', '2026-10-15T10:00:03Z'),
      ],
      [
        {
          id: 'r1',
          message: 'Recebido',
          sender_role: 'admin',
          created_at: '2026-10-15T09:00:00Z',
          user_id: 'rh',
        },
        {
          id: 'r2',
          message: 'Aqui vai',
          sender_role: 'employee',
          created_at: '2026-10-15T10:00:00Z',
          user_id: 'me',
        },
      ],
      'me'
    );
    expect(timeline.map(i => i.key)).toEqual([
      'ticket',
      'files-pedido',
      'r1',
      'r2',
      'files-resposta',
    ]);
    expect(timeline[2].mine).toBe(false);
  });
});
