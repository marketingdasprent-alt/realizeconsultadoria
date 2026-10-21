import React, { useState } from 'react';
import { ChevronRight, Eye, FolderOpen, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useCompanyFolder } from '../../hooks/useCompanyFolder';
import { useCompanyUploads } from '../../hooks/useCompanyUploads';
import { breadcrumbsFor } from '../../lib/companyFiles';
import type { CompanyEntry } from '../../services/companyFilesService';
import { CompanyFileGrid, ViewToggle, type FilesView } from './CompanyFileGrid';
import { CompanyFileRow } from './CompanyFileRow';
import { CompanyFolderActions } from './CompanyFolderActions';
import { CompanyUploadList } from './CompanyUploadList';

const VIEW_KEY = 'rz.docs.view';

/** Grelha (com miniaturas) por defeito; a escolha fica guardada neste aparelho. */
const readView = (): FilesView => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

interface CompanyFilesBrowserProps {
  /** Pasta aberta (null = pastas atribuídas). */
  path: string | null;
  onNavigate: (path: string | null) => void;
  onOpenFile: (entry: CompanyEntry) => void;
  onDownload: (entry: CompanyEntry) => void;
}

/**
 * Navegação nas pastas do servidor de ficheiros atribuídas ao colaborador. Nas pastas com
 * edição: novo documento, carregar (botão ou arrastar para cima da lista) e nova pasta.
 */
export const CompanyFilesBrowser: React.FC<CompanyFilesBrowserProps> = ({
  path,
  onNavigate,
  onOpenFile,
  onDownload,
}) => {
  const roots = useCompanyFolder(null);
  const folder = useCompanyFolder(path, path !== null);
  const listing = path === null ? roots : folder;

  const folders = (roots.data?.entries ?? []).map(entry => ({
    path: entry.path,
    name: entry.name,
  }));
  const crumbs = breadcrumbsFor(path, folders);
  const canEdit = !!path && listing.data?.permission === 'edit';
  const uploads = useCompanyUploads(path);
  const [view, setView] = useState<FilesView>(readView);
  const changeView = (next: FilesView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // sem armazenamento: só nesta sessão
    }
  };
  const { isDragging, dropProps } = useFileDrop(uploads.upload, canEdit);

  const open = (entry: CompanyEntry) =>
    entry.type === 'dir' ? onNavigate(entry.path) : onOpenFile(entry);

  return (
    <section
      {...dropProps}
      className={cn(
        'relative rounded-[28px] bg-white p-3 shadow-rz-soft ring-1 ring-rz-line md:p-5',
        isDragging && 'ring-2 ring-rz-primary'
      )}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[28px] bg-rz-primary-soft/90 text-[15px] font-bold text-rz-primary">
          <Upload className="h-8 w-8" /> Largue para carregar nesta pasta
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <nav aria-label="Caminho" className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path ?? 'root'}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-rz-muted" />}
              <button
                type="button"
                onClick={() => onNavigate(crumb.path)}
                disabled={index === crumbs.length - 1}
                className="max-w-[14rem] truncate rounded-full px-2 py-1 text-[13.5px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink disabled:text-rz-ink disabled:hover:bg-transparent"
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <ViewToggle value={view} onChange={changeView} />
        {path && listing.data?.permission === 'read' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rz-canvas px-3 py-1 text-[12px] font-semibold text-rz-muted">
            <Eye className="h-3.5 w-3.5" /> Só leitura
          </span>
        )}
        {path && canEdit && (
          <CompanyFolderActions path={path} onOpenFile={onOpenFile} onUpload={uploads.upload} />
        )}
      </div>

      {/* Na raiz só há as pastas de cada um: criar e carregar faz-se dentro de uma delas. */}
      {!path && (listing.data?.entries.length ?? 0) > 0 && (
        <p className="rounded-2xl bg-rz-primary-soft px-4 py-2.5 text-[13px] font-medium text-rz-primary">
          Abra uma pasta para criar documentos, carregar ficheiros ou criar subpastas.
        </p>
      )}

      <CompanyUploadList items={uploads.items} onDismiss={uploads.dismiss} />

      {listing.isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-rz-primary" />
      ) : listing.error ? (
        <p className="px-3 py-8 text-center text-[14px] text-rose-600">
          {listing.error.message || 'Não foi possível abrir esta pasta.'}
        </p>
      ) : !listing.data?.entries.length ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <FolderOpen className="h-10 w-10 text-rz-muted/60" />
          <p className="mt-3 max-w-sm text-[14px] text-rz-muted">
            {path
              ? canEdit
                ? 'Esta pasta está vazia. Crie um documento ou arraste ficheiros para aqui.'
                : 'Esta pasta está vazia.'
              : 'Ainda não tem pastas da empresa atribuídas. Peça acesso ao administrador.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <CompanyFileGrid entries={listing.data.entries} onOpen={open} onDownload={onDownload} />
      ) : (
        <ul className="space-y-0.5">
          {listing.data.entries.map(entry => (
            <CompanyFileRow key={entry.path} entry={entry} onOpen={open} onDownload={onDownload} />
          ))}
        </ul>
      )}
      {listing.data?.truncated && (
        <p className="mt-3 px-3 text-[12.5px] text-amber-700">
          Esta pasta tem demasiados ficheiros; só aparecem os primeiros 5000.
        </p>
      )}
    </section>
  );
};
