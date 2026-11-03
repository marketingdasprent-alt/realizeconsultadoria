import React from 'react';
import { ChevronRight, Download, Trash2 } from 'lucide-react';
import { formatFileSize } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { fileKind } from '../../lib/companyFiles';
import type { CompanyEntry } from '../../services/companyFilesService';
import { EntryContextMenu } from './EntryContextMenu';
import { KIND_STYLES } from './fileKindStyles';

const formatModified = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

interface CompanyFileRowProps {
  entry: CompanyEntry;
  /** Pasta: entrar; ficheiro: abrir no editor (ou descarregar, se não abrir). */
  onOpen: (entry: CompanyEntry) => void;
  onDownload: (entry: CompanyEntry) => void;
  /** Só para admins. */
  onDelete?: (entry: CompanyEntry) => void;
}

/** Uma linha da lista de ficheiros. */
export const CompanyFileRow: React.FC<CompanyFileRowProps> = ({
  entry,
  onOpen,
  onDownload,
  onDelete,
}) => {
  const { icon: Icon, tint } = KIND_STYLES[fileKind(entry)];
  const isFolder = entry.type === 'dir';
  const meta = isFolder
    ? 'Pasta'
    : [entry.size !== undefined ? formatFileSize(entry.size) : '', formatModified(entry.modified)]
        .filter(Boolean)
        .join(' · ');

  return (
    <EntryContextMenu entry={entry} onOpen={onOpen} onDownload={onDownload} onDelete={onDelete}>
      <li className="flex items-center gap-1 rounded-2xl hover:bg-rz-canvas">
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left"
        >
          <span
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold text-rz-ink">
              {entry.name}
            </span>
            {meta && <span className="block truncate text-[12.5px] text-rz-muted">{meta}</span>}
          </span>
          {isFolder && <ChevronRight className="h-4 w-4 shrink-0 text-rz-muted" />}
        </button>
        {!isFolder && (
          <button
            type="button"
            onClick={() => onDownload(entry)}
            aria-label={`Descarregar ${entry.name}`}
            title="Descarregar"
            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-primary"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`Eliminar ${entry.name}`}
            title="Eliminar"
            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </li>
    </EntryContextMenu>
  );
};
