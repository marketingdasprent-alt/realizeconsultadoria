import React from 'react';
import {
  CalendarPlus,
  ListChecks,
  MailOpen,
  MoreHorizontal,
  Printer,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type MoreAction = 'task' | 'event' | 'unread' | 'print';

const ITEMS: { action: MoreAction; label: string; icon: LucideIcon }[] = [
  { action: 'task', label: 'Criar tarefa', icon: ListChecks },
  { action: 'event', label: 'Criar evento', icon: CalendarPlus },
  { action: 'unread', label: 'Marcar como não lido', icon: MailOpen },
  { action: 'print', label: 'Imprimir', icon: Printer },
];

interface ReaderMoreMenuProps {
  onAction: (action: MoreAction) => void;
  /** Sem "Criar tarefa / evento" (app de email para clientes de fora). */
  hideRealize?: boolean;
  /** Imprimir só com o email já carregado. */
  canPrint: boolean;
  className?: string;
}

/** "⋯ Mais" da barra do email: as ações menos usadas, para a barra caber sem deslizar. */
export const ReaderMoreMenu: React.FC<ReaderMoreMenuProps> = ({
  onAction,
  canPrint,
  className,
  hideRealize = false,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger className={className} title="Mais ações" aria-label="Mais ações">
      <MoreHorizontal className="h-4 w-4" />
      <span className="hidden 2xl:inline">Mais</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56 rounded-xl">
      {ITEMS.filter(
        item => !hideRealize || (item.action !== 'task' && item.action !== 'event')
      ).map(({ action, label, icon: Icon }, index) => (
        <React.Fragment key={action}>
          {index === 2 && !hideRealize && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={() => onAction(action)}
            disabled={action === 'print' && !canPrint}
            className="gap-2"
          >
            <Icon className="h-4 w-4" /> {label}
          </DropdownMenuItem>
        </React.Fragment>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
