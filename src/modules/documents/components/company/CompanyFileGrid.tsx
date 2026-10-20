import React, { useState } from 'react';
import { Download, LayoutGrid, List } from 'lucide-react';
import { formatFileSize } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { useFolderThumbs } from '../../hooks/useFolderThumbs';
import { fileKind } from '../../lib/companyFiles';
import type { CompanyEntry } from '../../services/companyFilesService';
import { KIND_STYLES } from './fileKindStyles';

export type FilesView = 'list' | 'grid';

interface ViewToggleProps {
  value: FilesView;
  onChange: (view: FilesView) => void;
}

/** Lista ou grelha (com miniaturas), como no Explorador do Windows. */
export const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange }) => (
  <div
    className="flex rounded-full bg-rz-canvas p-0.5 ring-1 ring-rz-line"
    role="group"
    aria-label="Vista"
  >
    {(
      [
        ['list', List, 'Lista'],
        ['grid', LayoutGrid, 'Grelha'],
      ] as const
    ).map(([view, Icon, label]) => (
      <button
        key={view}
        type="button"
        aria-pressed={value === view}
        aria-label={label}
        title={label}
        onClick={() => onChange(view)}
        className={cn(
          'flex h-8 w-9 items-center justify-center rounded-full',
          value === view ? 'bg-white text-rz-primary shadow-sm' : 'text-rz-muted hover:text-rz-ink'
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    ))}
  </div>
);

interface CompanyFileGridProps {
  entries: CompanyEntry[];
  onOpen: (entry: CompanyEntry) => void;
  onDownload: (entry: CompanyEntry) => void;
}

/** Miniatura do ficheiro (ou o ícone do tipo enquanto chega / se não houver). */
const Thumb: React.FC<{ entry: CompanyEntry; url: string | null | undefined }> = ({
  entry,
  url,
}) => {
  const [failed, setFailed] = useState(false);
  const { icon: Icon, tint } = KIND_STYLES[fileKind(entry)];
  if (url && !failed)
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-top"
      />
    );
  return (
    <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', tint)}>
      <Icon className="h-7 w-7" />
    </span>
  );
};

/** Vista em grelha: pastas e ficheiros em cartões, com a 1.ª página ou a imagem. */
export const CompanyFileGrid: React.FC<CompanyFileGridProps> = ({
  entries,
  onOpen,
  onDownload,
}) => {
  const thumbs = useFolderThumbs(entries, true);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {entries.map(entry => (
        <li key={entry.path} className="group relative">
          <button
            type="button"
            onClick={() => onOpen(entry)}
            className="flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-rz-line transition hover:shadow-rz-soft hover:ring-rz-primary/40"
          >
            <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-rz-canvas">
              <Thumb entry={entry} url={thumbs[entry.path]} />
            </span>
            <span className="min-w-0 px-3 py-2">
              <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-rz-ink">
                {entry.name}
              </span>
              <span className="block truncate text-[11.5px] text-rz-muted">
                {entry.type === 'dir'
                  ? 'Pasta'
                  : entry.size !== undefined
                    ? formatFileSize(entry.size)
                    : ''}
              </span>
            </span>
          </button>
          {entry.type === 'file' && (
            <button
              type="button"
              onClick={() => onDownload(entry)}
              aria-label={`Descarregar ${entry.name}`}
              title="Descarregar"
              className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rz-muted shadow-sm hover:text-rz-primary group-hover:flex"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
