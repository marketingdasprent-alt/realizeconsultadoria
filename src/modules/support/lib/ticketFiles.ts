// Anexos dos tickets (as regras do formulário antigo) e a linha do tempo da conversa.
import type { SupportTicket, TicketAttachment, TicketReply } from './ticketRules';

export const TICKET_MAX_FILES = 5;
export const TICKET_MAX_BYTES = 10 * 1024 * 1024;
export const TICKET_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
export const TICKET_FILE_ACCEPT = TICKET_FILE_TYPES.join(',');

/** Junta ficheiros novos aos já escolhidos; devolve os aceites e o motivo dos recusados. */
export const addTicketFiles = (current: File[], incoming: File[]) => {
  const errors: string[] = [];
  const accepted = [...current];
  for (const file of incoming) {
    if (accepted.length >= TICKET_MAX_FILES) {
      errors.push(`Máximo ${TICKET_MAX_FILES} ficheiros de cada vez.`);
      break;
    }
    if (!TICKET_FILE_TYPES.includes(file.type))
      errors.push(`"${file.name}" não é suportado. Use imagens (JPG, PNG, WebP, GIF) ou PDF.`);
    else if (file.size > TICKET_MAX_BYTES) errors.push(`"${file.name}" excede o limite de 10 MB.`);
    else accepted.push(file);
  }
  return { files: accepted, errors };
};

/** Nota acrescentada à resposta com anexos (os RH veem-na também no email). */
export const replyWithFiles = (text: string, files: Pick<File, 'name'>[]) => {
  const note = files.length ? `📎 ${files.map(f => f.name).join(', ')}` : '';
  return [text.trim(), note].filter(Boolean).join('\n\n');
};

export type TimelineItem =
  | { kind: 'message'; key: string; mine: boolean; at: string; text: string }
  | { kind: 'files'; key: string; mine: boolean; at: string; files: TicketAttachment[] };

/** Anexos até 2 minutos depois de outra mensagem ficam juntos dela. */
const SAME_MOMENT_MS = 2 * 60_000;

/**
 * Pedido, nota dos RH, respostas e anexos por ordem de chegada. Anexos seguidos da mesma
 * pessoa juntam-se num só bloco.
 */
export const buildTimeline = (
  ticket: SupportTicket,
  attachments: TicketAttachment[],
  replies: TicketReply[],
  myUserId: string
): TimelineItem[] => {
  const items: TimelineItem[] = [
    { kind: 'message', key: 'ticket', mine: true, at: ticket.created_at, text: ticket.message },
    ...replies.map(r => ({
      kind: 'message' as const,
      key: r.id,
      mine: r.sender_role === 'employee',
      at: r.created_at,
      text: r.message,
    })),
  ];
  const sorted = [...attachments].sort((a, b) =>
    (a.created_at ?? ticket.created_at).localeCompare(b.created_at ?? ticket.created_at)
  );
  for (const file of sorted) {
    const at = file.created_at ?? ticket.created_at;
    const mine = !file.uploaded_by || file.uploaded_by === myUserId;
    const group = items.find(
      item =>
        item.kind === 'files' &&
        item.mine === mine &&
        Math.abs(new Date(at).getTime() - new Date(item.at).getTime()) < SAME_MOMENT_MS
    );
    if (group && group.kind === 'files') group.files.push(file);
    else items.push({ kind: 'files', key: `files-${file.id}`, mine, at, files: [file] });
  }

  // No mesmo instante, a mensagem vem antes dos anexos.
  const rank = (item: TimelineItem) => (item.key === 'ticket' ? 0 : item.kind === 'files' ? 2 : 1);
  const timeline = items.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || rank(a) - rank(b)
  );
  // A nota dos RH (campo antigo, sem data) fica logo a seguir ao pedido e aos seus anexos.
  if (ticket.admin_notes) {
    const after = timeline[1]?.kind === 'files' && timeline[1].mine ? 2 : 1;
    timeline.splice(after, 0, {
      kind: 'message',
      key: 'notes',
      mine: false,
      at: ticket.created_at,
      text: ticket.admin_notes,
    });
  }
  return timeline;
};
