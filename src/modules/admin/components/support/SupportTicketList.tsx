import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupportTicket } from '@/hooks/useAdminTickets';
import {
  isDone,
  PRIORITY_LABELS,
  statusLabel,
  type TicketActivity,
} from '../../lib/supportTickets';

interface SupportTicketListProps {
  tickets: SupportTicket[];
  activityOf: (ticket: SupportTicket) => TicketActivity;
  selectedId: string | null;
  onSelect: (ticket: SupportTicket) => void;
  departmentName: (id: string | null) => string | null;
}

/** Lista de tickets: à espera de resposta em destaque, com há quanto tempo. */
export const SupportTicketList: React.FC<SupportTicketListProps> = ({
  tickets,
  activityOf,
  selectedId,
  onSelect,
  departmentName,
}) => {
  if (!tickets.length)
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center text-rz-muted">
        <MessageSquare className="h-10 w-10 opacity-50" />
        <p className="mt-3 text-[14px]">Nenhum ticket com estes filtros.</p>
      </div>
    );

  return (
    <ul className="space-y-1 p-2">
      {tickets.map(ticket => {
        const activity = activityOf(ticket);
        const urgent = ticket.priority === 'urgent' || ticket.priority === 'high';
        const dept = departmentName(ticket.department_id);
        return (
          <li key={ticket.id}>
            <button
              type="button"
              onClick={() => onSelect(ticket)}
              aria-current={selectedId === ticket.id ? 'true' : undefined}
              className={cn(
                'w-full rounded-[20px] p-3 text-left transition-colors',
                selectedId === ticket.id
                  ? 'bg-rz-primary-soft ring-1 ring-rz-primary/30'
                  : 'hover:bg-rz-canvas'
              )}
            >
              <div className="flex items-start gap-2">
                {activity.awaiting && (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500"
                    aria-label="À espera de resposta"
                  />
                )}
                <p
                  className={cn(
                    'line-clamp-1 flex-1 text-[14px]',
                    activity.awaiting ? 'font-bold' : 'font-semibold'
                  )}
                >
                  {ticket.subject}
                </p>
                <time className="shrink-0 text-[11.5px] text-rz-muted">
                  {formatDistanceToNowStrict(new Date(activity.lastActivityAt), {
                    locale: pt,
                    addSuffix: false,
                  })}
                </time>
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-rz-muted">
                {ticket.employees?.name}
                {dept ? ` · ${dept}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {activity.awaiting && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold',
                      activity.waitingDays >= 7
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    )}
                  >
                    À espera{activity.waitingDays > 0 ? ` · ${activity.waitingDays} d` : ''}
                  </span>
                )}
                {urgent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    <AlertTriangle className="h-3 w-3" />
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    isDone(ticket.status)
                      ? 'bg-emerald-100 text-emerald-700'
                      : ticket.status === 'in_progress'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-rz-canvas text-rz-muted'
                  )}
                >
                  {statusLabel(ticket.status)}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
