import React from 'react';
import {
  AlertTriangle,
  Archive,
  File,
  Inbox,
  Layers,
  OctagonAlert,
  PenSquare,
  Plus,
  Send,
  Settings2,
  Star,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_DOTS, FOLDERS } from '../lib/mailFormat';
import type { MailAccount, MailFolder } from '../types';

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
  onScope: (scope: string) => void;
  onFolder: (folder: MailFolder) => void;
  onCompose: () => void;
  onConnect: () => void;
  onSettings: (account: MailAccount) => void;
  className?: string;
}

const ROW =
  'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold transition-colors';

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

    <section>
      <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">
        Caixas
      </p>
      {props.accounts.length > 1 && (
        <button
          type="button"
          onClick={() => props.onScope('all')}
          className={cn(
            ROW,
            props.scope === 'all' ? 'bg-white shadow-rz-soft' : 'hover:bg-white/70'
          )}
        >
          <Layers className="h-4 w-4 text-rz-primary" /> Todas as caixas
        </button>
      )}
      {props.accounts.map(account => (
        <div key={account.id} className="group relative">
          <button
            type="button"
            onClick={() => props.onScope(account.id)}
            className={cn(
              ROW,
              'pr-9',
              props.scope === account.id ? 'bg-white shadow-rz-soft' : 'hover:bg-white/70'
            )}
          >
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', ACCOUNT_DOTS[account.color])}
            />
            <span className="min-w-0 flex-1 truncate">{account.email}</span>
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
          </button>
          <button
            type="button"
            onClick={() => props.onSettings(account)}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-rz-muted opacity-60 hover:bg-rz-canvas hover:opacity-100"
            aria-label={`Definições de ${account.email}`}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={props.onConnect}
        className={cn(ROW, 'text-rz-primary hover:bg-white/70')}
      >
        <Plus className="h-4 w-4" /> Ligar caixa
      </button>
    </section>

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
              ROW,
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
