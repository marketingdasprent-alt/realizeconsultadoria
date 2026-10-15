import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupportTicket } from '../lib/ticketRules';
import { TicketBadges } from './TicketBadges';

interface TicketListItemProps {
  ticket: SupportTicket;
  attachmentCount: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}

/** Linha da lista de tickets: assunto, data, estado, prioridade e nº de anexos. */
export const TicketListItem: React.FC<TicketListItemProps> = ({
  ticket,
  attachmentCount,
  isActive,
  onSelect,
}) => (
  <button
    type="button"
    onClick={() => onSelect(ticket.id)}
    aria-current={isActive ? 'true' : undefined}
    className={cn(
      'w-full rounded-[22px] p-3.5 text-left transition-colors',
      isActive ? 'bg-rz-primary-soft ring-1 ring-rz-primary/30' : 'hover:bg-rz-canvas'
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className={cn('line-clamp-2 text-[14.5px] font-bold', isActive && 'text-rz-primary')}>
        {ticket.subject}
      </p>
      <span className="shrink-0 text-[11.5px] text-rz-muted">
        {format(new Date(ticket.created_at), 'dd MMM', { locale: pt })}
      </span>
    </div>
    <p className="mt-1 line-clamp-1 text-[13px] text-rz-muted">{ticket.message}</p>
    <div className="mt-2 flex items-center gap-2">
      <TicketBadges status={ticket.status} priority={ticket.priority} />
      {attachmentCount > 0 && (
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-rz-muted">
          <Paperclip className="h-3.5 w-3.5" /> {attachmentCount}
        </span>
      )}
    </div>
  </button>
);
