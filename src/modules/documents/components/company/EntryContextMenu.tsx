import React from 'react';
import { Copy, Download, ExternalLink, FolderOpen, Link2, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import { parentPath } from '../../../../../supabase/functions/_shared/company-files';
import { opensInEditor, previewKind } from '../../lib/companyFiles';
import type { CompanyEntry } from '../../services/companyFilesService';

interface EntryContextMenuProps {
  entry: CompanyEntry;
  onOpen: (entry: CompanyEntry) => void;
  onDownload: (entry: CompanyEntry) => void;
  /** Só para admins. */
  onDelete?: (entry: CompanyEntry) => void;
  /** O <li> do ficheiro ou da pasta. */
  children: React.ReactElement;
}

/** Link do Realize que abre a pasta (ou o ficheiro, dentro da sua pasta). */
const linkFor = (entry: CompanyEntry) => {
  const search = new URLSearchParams();
  if (entry.type === 'dir') search.set('pasta', entry.path);
  else {
    search.set('pasta', parentPath(entry.path));
    if (opensInEditor(entry)) search.set('abrir', entry.path);
    else if (previewKind(entry)) search.set('ver', entry.path);
  }
  return `${window.location.origin}${window.location.pathname}?${search.toString()}`;
};

/** Clique direito (ou toque longo) num ficheiro ou pasta: as ações do Realize. */
export const EntryContextMenu: React.FC<EntryContextMenuProps> = ({
  entry,
  onOpen,
  onDownload,
  onDelete,
  children,
}) => {
  const { toast } = useToast();
  const isFolder = entry.type === 'dir';

  const copy = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 rounded-xl">
        <ContextMenuItem onSelect={() => onOpen(entry)} className="gap-2">
          {isFolder ? <FolderOpen className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          {isFolder ? 'Abrir pasta' : 'Abrir'}
        </ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem onSelect={() => onDownload(entry)} className="gap-2">
            <Download className="h-4 w-4" /> Descarregar
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copy(linkFor(entry), 'Link copiado')} className="gap-2">
          <Link2 className="h-4 w-4" /> Copiar link
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copy(entry.name, 'Nome copiado')} className="gap-2">
          <Copy className="h-4 w-4" /> Copiar nome
        </ContextMenuItem>
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onDelete(entry)}
              className="gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
