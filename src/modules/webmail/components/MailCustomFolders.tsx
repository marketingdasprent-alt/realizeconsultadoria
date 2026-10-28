import React, { useMemo, useState } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_DOTS, SIDEBAR_ROW, accountName } from '../lib/mailFormat';
import type { MailAccount, MailCustomFolder } from '../types';
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
}) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const shown = accounts.filter(
    a => (scope === 'all' || a.id === scope) && byAccount[a.id]?.length
  );
  const trees = useMemo(
    () => new Map(shown.map(a => [a.id, childrenOf(byAccount[a.id])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shown deriva de accounts/scope
    [byAccount, accounts, scope]
  );
  if (!shown.length) return null;

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
      return (
        <li key={key}>
          <div className="relative">
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
              onClick={() => onPick({ accountId: account.id, id: folder.id, name: folder.name })}
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
          </div>
          {isOpen && kids.length > 0 && <ul>{renderLevel(account, folder.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <section>
      <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">
        As minhas pastas
      </p>
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
