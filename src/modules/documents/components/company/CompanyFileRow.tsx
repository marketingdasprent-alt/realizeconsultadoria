import React from 'react';
import {
  ChevronRight,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { formatFileSize } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { fileKind, type FileKind } from '../../lib/companyFiles';
import type { CompanyEntry } from '../../services/companyFilesService';

const KIND_STYLES: Record<FileKind, { icon: LucideIcon; tint: string }> = {
  folder: { icon: Folder, tint: 'bg-amber-100 text-amber-600' },
  word: { icon: FileText, tint: 'bg-blue-100 text-blue-600' },
  cell: { icon: FileSpreadsheet, tint: 'bg-emerald-100 text-emerald-600' },
  slide: { icon: Presentation, tint: 'bg-orange-100 text-orange-600' },
  pdf: { icon: FileType2, tint: 'bg-rose-100 text-rose-600' },
  image: { icon: FileImage, tint: 'bg-violet-100 text-violet-600' },
  other: { icon: File, tint: 'bg-slate-100 text-slate-500' },
};

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
}

/** Uma linha da lista de ficheiros. */
export const CompanyFileRow: React.FC<CompanyFileRowProps> = ({ entry, onOpen, onDownload }) => {
  const { icon: Icon, tint } = KIND_STYLES[fileKind(entry)];
  const isFolder = entry.type === 'dir';
  const meta = isFolder
    ? 'Pasta'
    : [entry.size !== undefined ? formatFileSize(entry.size) : '', formatModified(entry.modified)]
        .filter(Boolean)
        .join(' · ');

  return (
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
    </li>
  );
};
