import React from 'react';
import {
  AlertTriangle,
  BellOff,
  FolderPlus,
  GripVertical,
  Inbox,
  Settings2,
  Tag,
  Users,
  Workflow,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { ACCOUNT_DOTS, SIDEBAR_ROW, accountName } from '../lib/mailFormat';
import type { MailAccount } from '../types';

/** Número de emails por ler (nada quando é 0). */
export const UnreadCount: React.FC<{ value?: number }> = ({ value }) =>
  value ? (
    <span
      className="shrink-0 rounded-full bg-rz-primary-soft px-1.5 py-px text-[11.5px] font-bold tabular-nums text-rz-primary"
      aria-label={`${value} por ler`}
    >
      {value > 999 ? '999+' : value}
    </span>
  ) : null;

// Pega na margem esquerda da barra (com área de toque maior); no rato só aparece ao passar.
const HANDLE =
  "absolute inset-y-0 -left-3 flex w-3 cursor-grab touch-none items-center justify-center text-rz-muted opacity-40 outline-none before:absolute before:inset-y-0 before:left-0 before:-right-3 before:touch-none before:content-[''] focus-visible:opacity-100 active:cursor-grabbing [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-70";

interface MailAccountRowProps {
  account: MailAccount;
  isActive: boolean;
  unread?: number;
  isDragging: boolean;
  /** Eventos da pega de arrastar (sem pega quando só há uma caixa). */
  handleProps?: React.HTMLAttributes<HTMLSpanElement>;
  rowRef: (element: HTMLElement | null) => void;
  onScope: (id: string) => void;
  onSettings: (account: MailAccount) => void;
  /** Atalhos do botão direito (cada um só aparece se existir). */
  onNewFolder?: (accountId: string) => void;
  onLabels?: (accountId: string) => void;
  onRules?: (accountId: string) => void;
}

/** Uma caixa na barra lateral: cor, endereço, estado, "por ler" e definições. */
export const MailAccountRow: React.FC<MailAccountRowProps> = ({
  account,
  isActive,
  unread,
  isDragging,
  handleProps,
  rowRef,
  onScope,
  onSettings,
  onNewFolder,
  onLabels,
  onRules,
}) => (
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <li
        ref={rowRef}
        className={cn('group relative rounded-2xl', isDragging && 'z-10 bg-white shadow-rz-soft')}
      >
        {handleProps && (
          <span
            role="button"
            tabIndex={0}
            title="Arrastar para mudar a ordem"
            aria-label={`Mudar a ordem de ${account.email} (arrastar ou setas)`}
            className={HANDLE}
            {...handleProps}
          >
            <GripVertical className="h-3.5 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={() => onScope(account.id)}
          className={cn(
            SIDEBAR_ROW,
            'pr-9',
            isActive ? 'bg-white shadow-rz-soft' : 'hover:bg-white/70'
          )}
        >
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', ACCOUNT_DOTS[account.color])} />
          <span className="min-w-0 flex-1 truncate" title={account.email}>
            {accountName(account)}
          </span>
          {!account.notify && (
            <BellOff className="h-3.5 w-3.5 shrink-0 text-rz-muted" aria-label="Sem avisos" />
          )}
          {account.shared && (
            <Users
              className="h-3.5 w-3.5 shrink-0 text-rz-muted"
              aria-label="Partilhada pela empresa"
            />
          )}
          {account.status !== 'active' && (
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-amber-500"
              aria-label="Requer atenção"
            />
          )}
          <UnreadCount value={unread} />
        </button>
        <button
          type="button"
          onClick={() => onSettings(account)}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-rz-muted opacity-60 hover:bg-rz-canvas hover:opacity-100"
          aria-label={`Definições de ${account.email}`}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </li>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => onScope(account.id)}>
        <Inbox className="mr-2 h-4 w-4" /> Ver só esta caixa
      </ContextMenuItem>
      {onNewFolder && (
        <ContextMenuItem onSelect={() => onNewFolder(account.id)}>
          <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta…
        </ContextMenuItem>
      )}
      {onLabels && (
        <ContextMenuItem onSelect={() => onLabels(account.id)}>
          <Tag className="mr-2 h-4 w-4" /> Marcadores…
        </ContextMenuItem>
      )}
      {onRules && (
        <ContextMenuItem onSelect={() => onRules(account.id)}>
          <Workflow className="mr-2 h-4 w-4" /> Regras automáticas…
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onSettings(account)}>
        <Settings2 className="mr-2 h-4 w-4" /> Definições da caixa…
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
