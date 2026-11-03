import React, { useState } from 'react';
import {
  ExternalLink,
  Folder,
  FolderInput,
  FolderPlus,
  Mail,
  MailOpen,
  Star,
  Trash2,
  Workflow,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useAccountFolders } from '../hooks/useAccountFolders';
import { useFolderActions, type MoveTarget } from '../hooks/useFolderActions';
import type { MailChange } from '../hooks/useMailChanges';
import { flattenFolders } from '../lib/folderTree';
import type { MailAccount, MailSummary } from '../types';
import { NewMailFolderDialog } from './NewMailFolderDialog';

interface MailContextMenuProps {
  mail: MailSummary;
  /** O que o menu atua: o email, ou os selecionados se ele for um deles (todos da mesma caixa). */
  targets: MailSummary[];
  accounts: MailAccount[];
  onOpen: (mail: MailSummary) => void;
  onChange: (mails: MailSummary[], kind: MailChange) => void;
  onMove: (mails: MailSummary[], target: MoveTarget) => void;
  /** "Criar regra para este remetente…". */
  onRule?: (mail: MailSummary) => void;
  /** O <li> da linha. */
  children: React.ReactElement;
}

/** Clique direito (ou toque longo) num email: abrir, ler/não lido, estrela, mover para…, lixo. */
export const MailContextMenu: React.FC<MailContextMenuProps> = ({
  mail,
  targets,
  accounts,
  onOpen,
  onChange,
  onMove,
  onRule,
  children,
}) => {
  const { isPreview } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { create } = useFolderActions();
  const folders = useAccountFolders(menuOpen ? mail.accountId : null);
  const many = targets.length > 1;
  const list = flattenFolders(folders.data ?? []);
  const allStarred = targets.every(m => m.starred);
  const allRead = targets.every(m => !m.unread);

  return (
    <>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-60 rounded-xl">
          {!many && (
            <ContextMenuItem onSelect={() => onOpen(mail)} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Abrir
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onSelect={() => onChange(targets, allRead ? 'unread' : 'read')}
            className="gap-2"
          >
            {allRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
            {allRead ? 'Marcar como não lido' : 'Marcar como lido'}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => onChange(targets, allStarred ? 'unstar' : 'star')}
            className="gap-2"
          >
            <Star className="h-4 w-4" /> {allStarred ? 'Tirar estrela' : 'Pôr estrela'}
          </ContextMenuItem>
          {!isPreview && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2">
                  <FolderInput className="mr-2 h-4 w-4" /> Mover para
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-56 overflow-y-auto rounded-xl">
                  {folders.isLoading && (
                    <p className="px-2 py-1.5 text-[13px] text-rz-muted">A carregar…</p>
                  )}
                  {!folders.isLoading && list.length === 0 && (
                    <p className="px-2 py-1.5 text-[13px] text-rz-muted">Ainda não tem pastas.</p>
                  )}
                  {list.map(({ folder, depth }) => (
                    <ContextMenuItem
                      key={folder.id}
                      onSelect={() => onMove(targets, { id: folder.id, name: folder.name })}
                      style={{ paddingLeft: 8 + depth * 14 }}
                      className="gap-2"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-rz-muted" />
                      <span className="truncate">{folder.name}</span>
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => setCreating(true)}
                    className="gap-2 font-bold text-rz-primary"
                  >
                    <FolderPlus className="h-4 w-4" /> Nova pasta…
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              {onRule && mail.from && !many && (
                <ContextMenuItem onSelect={() => onRule(mail)} className="gap-2">
                  <Workflow className="h-4 w-4" /> Criar regra para este remetente…
                </ContextMenuItem>
              )}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => onChange(targets, 'trash')}
            className="gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
          >
            <Trash2 className="h-4 w-4" /> Mover para o lixo
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <NewMailFolderDialog
        open={creating}
        onClose={() => setCreating(false)}
        accounts={accounts}
        accountId={mail.accountId}
        onCreate={async (account, name, parent) => {
          const result = await create(account, name, parent);
          if (result.error || !result.id) return result.error;
          onMove(targets, { id: result.id, name });
          return null;
        }}
      />
    </>
  );
};
