import React from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATUS_OPTIONS } from '../../lib/supportTickets';

const STATUS_STYLE: Record<string, { dot: string; pill: string }> = {
  open: { dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 ring-orange-200' },
  in_progress: { dot: 'bg-sky-500', pill: 'bg-sky-50 text-sky-700 ring-sky-200' },
  resolved: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

interface TicketStatusMenuProps {
  /** Estado atual ("closed" antigo conta como resolvido). */
  status: string;
  onChange: (status: string) => void;
  busy: boolean;
}

/** Estado do ticket: pílula com a cor do estado e menu para mudar. */
export const TicketStatusMenu: React.FC<TicketStatusMenuProps> = ({ status, onChange, busy }) => {
  const value = status === 'closed' ? 'resolved' : status;
  const current = STATUS_OPTIONS.find(option => option.value === value) ?? STATUS_OPTIONS[0];
  const style = STATUS_STYLE[current.value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button
          type="button"
          aria-label={`Estado: ${current.label}`}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-2.5 text-[13px] font-bold ring-1 transition-colors disabled:opacity-60',
            style.pill
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className={cn('h-2 w-2 rounded-full', style.dot)} />
          )}
          {current.label}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5 shadow-rz-pop">
        {STATUS_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => option.value !== value && onChange(option.value)}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold"
          >
            <span className={cn('h-2 w-2 rounded-full', STATUS_STYLE[option.value].dot)} />
            <span className="flex-1">{option.label}</span>
            {option.value === value && <Check className="h-4 w-4 text-rz-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
