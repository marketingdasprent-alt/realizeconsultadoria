import React from 'react';
import {
  Archive,
  File,
  Inbox,
  OctagonAlert,
  PenSquare,
  Send,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOLDERS, SIDEBAR_ROW } from '../lib/mailFormat';
import type { MailAccount, MailFolder } from '../types';
import { MailAccountList } from './MailAccountList';

const FOLDER_ICONS: Record<MailFolder, LucideIcon> = {
  inbox: Inbox,
  starred: Star,
  sent: Send,
  drafts: File,
  archive: Archive,
  spam: OctagonAlert,
  trash: Trash2,
};

interface MailSidebarProps {
  accounts: MailAccount[];
  scope: string;
  folder: MailFolder;
  /** Emails por ler na Entrada, por caixa, e o total. */
  unread: Record<string, number>;
  unreadTotal: number;
  onScope: (scope: string) => void;
  onFolder: (folder: MailFolder) => void;
  onCompose: () => void;
  onConnect: () => void;
  onSettings: (account: MailAccount) => void;
  onReorder: (ids: string[]) => void;
  className?: string;
}

/** Caixas ligadas (e a caixa unificada) e as pastas. */
export const MailSidebar: React.FC<MailSidebarProps> = props => (
  <aside
    className={cn(
      'rz-scroll flex flex-col gap-4 overflow-y-auto bg-rz-canvas/60 p-3',
      props.className
    )}
  >
    <button
      type="button"
      onClick={props.onCompose}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-bold text-white shadow-rz-soft"
    >
      <PenSquare className="h-[18px] w-[18px]" /> Escrever
    </button>

    <MailAccountList
      accounts={props.accounts}
      scope={props.scope}
      unread={props.unread}
      unreadTotal={props.unreadTotal}
      onScope={props.onScope}
      onSettings={props.onSettings}
      onConnect={props.onConnect}
      onReorder={props.onReorder}
    />

    <section>
      <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">
        Pastas
      </p>
      {FOLDERS.map(({ key, label }) => {
        const Icon = FOLDER_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => props.onFolder(key)}
            className={cn(
              SIDEBAR_ROW,
              props.folder === key ? 'bg-rz-primary-soft text-rz-primary' : 'hover:bg-white/70'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </section>
  </aside>
);
