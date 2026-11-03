import React from 'react';
import { Folder, FolderInput, FolderPlus } from 'lucide-react';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { flattenFolders } from '../lib/folderTree';
import type { MoveTarget } from '../hooks/useFolderActions';
import type { MailCustomFolder } from '../types';

interface MailMoveSubmenuProps {
  folders: MailCustomFolder[];
  isLoading: boolean;
  onMove: (target: MoveTarget) => void;
  onNewFolder: () => void;
}

/** "Mover para ▸": as pastas da caixa, em árvore, e "Nova pasta…". */
export const MailMoveSubmenu: React.FC<MailMoveSubmenuProps> = ({
  folders,
  isLoading,
  onMove,
  onNewFolder,
}) => {
  const list = flattenFolders(folders);
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="gap-2">
        <FolderInput className="mr-2 h-4 w-4" /> Mover para
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 w-56 overflow-y-auto rounded-xl">
        {isLoading && <p className="px-2 py-1.5 text-[13px] text-rz-muted">A carregar…</p>}
        {!isLoading && list.length === 0 && (
          <p className="px-2 py-1.5 text-[13px] text-rz-muted">Ainda não tem pastas.</p>
        )}
        {list.map(({ folder, depth }) => (
          <ContextMenuItem
            key={folder.id}
            onSelect={() => onMove({ id: folder.id, name: folder.name })}
            style={{ paddingLeft: 8 + depth * 14 }}
            className="gap-2"
          >
            <Folder className="h-4 w-4 shrink-0 text-rz-muted" />
            <span className="truncate">{folder.name}</span>
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onNewFolder} className="gap-2 font-bold text-rz-primary">
          <FolderPlus className="h-4 w-4" /> Nova pasta…
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
};
