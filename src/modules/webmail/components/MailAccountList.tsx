import React from 'react';
import { ArrowDownAZ, Layers, MoreHorizontal, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSortableList } from '../hooks/useSortableList';
import { sortByEmail } from '../lib/accountOrder';
import { SIDEBAR_ROW } from '../lib/mailFormat';
import type { MailAccount } from '../types';
import { MailAccountRow, UnreadCount } from './MailAccountRow';

interface MailAccountListProps {
  accounts: MailAccount[];
  scope: string;
  /** Emails por ler na Entrada, por caixa. */
  unread: Record<string, number>;
  unreadTotal: number;
  onScope: (scope: string) => void;
  onSettings: (account: MailAccount) => void;
  onConnect: () => void;
  onReorder: (ids: string[]) => void;
}

/** Caixas ligadas: a caixa unificada, os "por ler" e a ordem (arrastar ou alfabética). */
export const MailAccountList: React.FC<MailAccountListProps> = props => {
  const byId = new Map(props.accounts.map(account => [account.id, account]));
  const sortable = useSortableList(
    props.accounts.map(account => account.id),
    props.onReorder
  );
  const many = props.accounts.length > 1;

  return (
    <section>
      <div className="mb-1 flex h-6 items-center justify-between px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">Caixas</p>
        {many && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="-mr-1.5 flex h-6 w-6 items-center justify-center rounded-full text-rz-muted hover:bg-white"
              aria-label="Ordem das caixas"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => props.onReorder(sortByEmail(props.accounts).map(a => a.id))}
              >
                <ArrowDownAZ className="mr-2 h-4 w-4" /> Ordenar por ordem alfabética
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {many && (
        <button
          type="button"
          onClick={() => props.onScope('all')}
          className={cn(
            SIDEBAR_ROW,
            props.scope === 'all' ? 'bg-white shadow-rz-soft' : 'hover:bg-white/70'
          )}
        >
          <Layers className="h-4 w-4 text-rz-primary" />
          <span className="min-w-0 flex-1 truncate">Todas as caixas</span>
          <UnreadCount value={props.unreadTotal} />
        </button>
      )}
      <ul>
        {sortable.order.map(id => {
          const account = byId.get(id);
          return account ? (
            <MailAccountRow
              key={id}
              account={account}
              isActive={props.scope === id}
              unread={props.unread[id]}
              isDragging={sortable.dragging === id}
              handleProps={many ? sortable.handleProps(id) : undefined}
              rowRef={sortable.rowRef(id)}
              onScope={props.onScope}
              onSettings={props.onSettings}
            />
          ) : null;
        })}
      </ul>
      <button
        type="button"
        onClick={props.onConnect}
        className={cn(SIDEBAR_ROW, 'text-rz-primary hover:bg-white/70')}
      >
        <Plus className="h-4 w-4" /> Ligar caixa
      </button>
    </section>
  );
};
