import React, { useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { useMailDrop } from '../hooks/useMailDrop';
import { ACCOUNT_DOTS, SIDEBAR_ROW, accountName } from '../lib/mailFormat';
import type { MailAccount, MailCustomFolder, MailSummary } from '../types';
import { UnreadCount } from './MailAccountRow';

export interface CustomFolderRef {
  accountId: string;
  id: string;
  name: string;
}

interface MailCustomFoldersProps {
  accounts: MailAccount[];
  /** Caixa à vista ("all" = todas, cada uma com o seu título). */
  scope: string;
  byAccount: Record<string, MailCustomFolder[]>;
  selected: CustomFolderRef | null;
  onPick: (folder: CustomFolderRef) => void;
  /** Nova pasta (accountId null = a pessoa escolhe a caixa) ou subpasta de parentId. */
  onNew?: (accountId: string | null, parentId: string | null) => void;
  /** Emails largados em cima de uma pasta (arrastar da lista). */
  onDropMails?: (mails: MailSummary[], folder: CustomFolderRef) => void;
  /** Mudar o nome / apagar (menu do botão direito). */
  onRename?: (folder: CustomFolderRef) => void;
  onDelete?: (folder: CustomFolderRef) => void;
}

const childrenOf = (folders: MailCustomFolder[]) => {
  const map = new Map<string | null, MailCustomFolder[]>();
  for (const folder of folders) {
    const key = folder.parentId;
    map.set(key, [...(map.get(key) ?? []), folder]);
  }
  map.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name, 'pt')));
  return map;
};

/** Pastas criadas pela pessoa (no Outlook, Gmail…), em árvore; as subpastas abrem com a seta. */
export const MailCustomFolders: React.FC<MailCustomFoldersProps> = ({
  accounts,
  scope,
  byAccount,
  selected,
  onPick,
  onNew,
  onDropMails,
  onRename,
  onDelete,
}) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const drop = useMailDrop();
  const shown = accounts.filter(
    a => (scope === 'all' || a.id === scope) && byAccount[a.id]?.length
  );
  const trees = useMemo(
    () => new Map(shown.map(a => [a.id, childrenOf(byAccount[a.id])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shown deriva de accounts/scope
    [byAccount, accounts, scope]
  );
  if (!shown.length && !onNew) return null;

  const toggle = (key: string) =>
    setOpen(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const renderLevel = (account: MailAccount, parentId: string | null, depth: number) =>
    (trees.get(account.id)?.get(parentId) ?? []).map(folder => {
      const key = `${account.id}|${folder.id}`;
      const kids = trees.get(account.id)?.get(folder.id) ?? [];
      const isOpen = open.has(key);
      const isActive = selected?.accountId === account.id && selected.id === folder.id;
      const ref: CustomFolderRef = { accountId: account.id, id: folder.id, name: folder.name };
      const row = (
        <div
          className={cn(
            'group relative rounded-2xl',
            drop.overKey === key && 'bg-rz-primary-soft ring-2 ring-rz-primary'
          )}
          {...(onDropMails ? drop.bind(key, account.id, mails => onDropMails(mails, ref)) : {})}
        >
          {kids.length > 0 && (
            <button
              type="button"
              onClick={() => toggle(key)}
              className="absolute top-1/2 z-10 flex h-6 w-5 -translate-y-1/2 items-center justify-center text-rz-muted hover:text-rz-ink"
              style={{ left: 2 + depth * 14 }}
              aria-label={isOpen ? `Fechar ${folder.name}` : `Abrir ${folder.name}`}
              aria-expanded={isOpen}
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => onPick(ref)}
            className={cn(
              SIDEBAR_ROW,
              isActive ? 'bg-rz-primary-soft text-rz-primary' : 'hover:bg-white/70'
            )}
            style={{ paddingLeft: 22 + depth * 14 }}
            title={folder.name}
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
            <UnreadCount value={folder.unread ?? undefined} />
          </button>
          {onNew && (
            <button
              type="button"
              onClick={() => onNew(account.id, folder.id)}
              aria-label={`Nova subpasta em ${folder.name}`}
              title="Nova subpasta"
              className="absolute right-1.5 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-rz-muted shadow-sm hover:text-rz-primary [@media(hover:hover)]:group-hover:flex"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
      return (
        <li key={key}>
          <ContextMenu>
            <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onSelect={() => onPick(ref)}>
                <FolderOpen className="mr-2 h-4 w-4" /> Abrir
              </ContextMenuItem>
              {onNew && (
                <ContextMenuItem onSelect={() => onNew(account.id, folder.id)}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Nova subpasta…
                </ContextMenuItem>
              )}
              {(onRename || onDelete) && <ContextMenuSeparator />}
              {onRename && (
                <ContextMenuItem onSelect={() => onRename(ref)}>
                  <Pencil className="mr-2 h-4 w-4" /> Mudar o nome…
                </ContextMenuItem>
              )}
              {onDelete && (
                <ContextMenuItem
                  onSelect={() => onDelete(ref)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Apagar pasta…
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
          {isOpen && kids.length > 0 && <ul>{renderLevel(account, folder.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <section>
      <div className="mb-1 flex items-center justify-between px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">
          As minhas pastas
        </p>
        {onNew && (
          <button
            type="button"
            onClick={() => onNew(scope === 'all' ? null : scope, null)}
            aria-label="Nova pasta"
            title="Nova pasta"
            className="flex h-6 w-6 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      {!shown.length && (
        <p className="px-3 pb-1 text-[12.5px] text-rz-muted">
          Crie pastas para organizar os emails (ex.: Tratados).
        </p>
      )}
      {shown.map(account => (
        <div key={account.id} className="mb-1">
          {scope === 'all' && (
            <p className="flex items-center gap-2 px-3 pb-0.5 pt-1.5 text-[12px] font-semibold text-rz-muted">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCOUNT_DOTS[account.color])} />
              <span className="truncate">{accountName(account)}</span>
            </p>
          )}
          <ul>{renderLevel(account, null, 0)}</ul>
        </div>
      ))}
    </section>
  );
};
