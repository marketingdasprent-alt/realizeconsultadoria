import React, { useState } from 'react';
import { Folder, FolderInput, FolderPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { useFolderActions, type MoveTarget } from '../hooks/useFolderActions';
import { flattenFolders } from '../lib/folderTree';
import type { MailAccount, MailSummary } from '../types';
import { NewMailFolderDialog } from './NewMailFolderDialog';

interface MoveToFolderProps {
  /** Emails a mover (todos da mesma caixa). */
  mails: MailSummary[];
  accounts: MailAccount[];
  onMove: (mails: MailSummary[], target: MoveTarget) => void;
  /** Aspeto do botão (barra de seleção: só ícone; leitor: ícone e texto em ecrãs largos). */
  className?: string;
  withLabel?: boolean;
}

/** Botão "Mover para…": lista as pastas da caixa e permite criar uma nova. */
export const MoveToFolder: React.FC<MoveToFolderProps> = ({
  mails,
  accounts,
  onMove,
  className,
  withLabel,
}) => {
  const { isPreview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { create } = useFolderActions();
  const accountId = mails[0]?.accountId ?? null;
  const folders = useAccountFolders(open ? accountId : null);
  if (isPreview || !accountId) return null;

  const list = flattenFolders(folders.data ?? []);
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Mover para…"
            aria-label="Mover para uma pasta"
            className={className}
          >
            <FolderInput className="h-4 w-4" />
            {withLabel && <span className="hidden 2xl:inline">Mover para</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 rounded-2xl p-1.5">
          <p className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-rz-muted">
            Mover para
          </p>
          <div className="rz-scroll max-h-64 overflow-y-auto">
            {folders.isLoading && (
              <p className="px-2.5 py-2 text-[13px] text-rz-muted">A carregar…</p>
            )}
            {!folders.isLoading && list.length === 0 && (
              <p className="px-2.5 py-2 text-[13px] text-rz-muted">Ainda não tem pastas.</p>
            )}
            {list.map(({ folder, depth }) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onMove(mails, { id: folder.id, name: folder.name });
                }}
                style={{ paddingLeft: 10 + depth * 14 }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl py-2 pr-2.5 text-left text-[13.5px] font-semibold hover:bg-rz-canvas'
                )}
              >
                <Folder className="h-4 w-4 shrink-0 text-rz-muted" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-rz-line px-2.5 py-2 text-left text-[13.5px] font-bold text-rz-primary hover:bg-rz-canvas"
          >
            <FolderPlus className="h-4 w-4 shrink-0" /> Nova pasta…
          </button>
        </PopoverContent>
      </Popover>
      <NewMailFolderDialog
        open={creating}
        onClose={() => setCreating(false)}
        accounts={accounts}
        accountId={accountId}
        onCreate={async (account, name, parent) => {
          const result = await create(account, name, parent);
          if (result.error || !result.id) return result.error;
          onMove(mails, { id: result.id, name });
          return null;
        }}
      />
    </>
  );
};
