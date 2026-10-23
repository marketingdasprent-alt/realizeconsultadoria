import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import { useTicketFiles } from '@/modules/support/hooks/useTicketFiles';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useTicketDetail } from '../../hooks/useSupportConversation';
import { PRIORITY_LABELS } from '../../lib/supportTickets';
import { TicketConversation } from './TicketConversation';
import { TicketInternalNote } from './TicketInternalNote';
import { TicketStatusMenu } from './TicketStatusMenu';

interface SupportTicketDetailProps {
  ticket: SupportTicket;
  departmentName: string | null;
  onBack: () => void;
  onStatus: (status: string) => void;
  onReply: (message: string, files: File[]) => Promise<boolean>;
  onPrint: (replies: { sender_role: string; message: string; created_at: string }[]) => void;
  busy: boolean;
}

/** Ticket aberto: quem pediu, estado, conversa (com anexos) e nota interna. */
export const SupportTicketDetail: React.FC<SupportTicketDetailProps> = ({
  ticket,
  departmentName,
  onBack,
  onStatus,
  onReply,
  onPrint,
  busy,
}) => {
  const { replies, attachments, isLoading } = useTicketDetail(ticket.id);
  const files = useTicketFiles();
  const { isDragging, dropProps } = useFileDrop(files.add);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...dropProps}>
      <DropOverlay visible={isDragging} label="Largue para anexar à resposta" />
      <header className="flex flex-wrap items-start gap-3 border-b border-rz-line px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-rz-canvas lg:hidden"
          aria-label="Voltar à lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-[16rem] flex-1">
          <h2 className="text-[18px] font-extrabold leading-tight">{ticket.subject}</h2>
          <p className="mt-1 text-[12.5px] text-rz-muted">
            {ticket.employees?.name} · {ticket.employees?.email}
            <br />
            {ticket.companies?.name}
            {departmentName ? ` · ${departmentName}` : ''} ·{' '}
            {format(new Date(ticket.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })} ·
            Prioridade {PRIORITY_LABELS[ticket.priority]?.toLowerCase() ?? ticket.priority}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusMenu status={ticket.status} onChange={onStatus} busy={busy} />
          <button
            type="button"
            onClick={() => onPrint(replies)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-ink"
            aria-label="Imprimir"
            title="Imprimir"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="rz-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />
        ) : (
          <TicketConversation
            employeeName={ticket.employees?.name ?? 'Colaborador'}
            firstMessage={{ text: ticket.message, at: ticket.created_at }}
            legacyNote={ticket.admin_notes}
            replies={replies}
            attachments={attachments}
            files={files}
            onReply={onReply}
          />
        )}

        <TicketInternalNote ticketId={ticket.id} />
      </div>
    </div>
  );
};
