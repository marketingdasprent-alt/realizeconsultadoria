import React from 'react';
import { cn } from '@/lib/utils';
import { TICKET_PRIORITY, TICKET_STATUS } from '../lib/ticketRules';

const CHIP = 'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold';

/** Estado e prioridade de um ticket. */
export const TicketBadges: React.FC<{ status: string; priority: string }> = ({
  status,
  priority,
}) => (
  <span className="inline-flex flex-wrap gap-1.5">
    <span className={cn(CHIP, TICKET_STATUS[status]?.chip)}>
      {TICKET_STATUS[status]?.label ?? status}
    </span>
    <span className={cn(CHIP, TICKET_PRIORITY[priority]?.chip)}>
      {TICKET_PRIORITY[priority]?.label ?? priority}
    </span>
  </span>
);
