import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Eye, FolderOpen, FolderPlus, Loader2 } from 'lucide-react';
import { companyFolderKey, useCompanyFolder } from '../../hooks/useCompanyFolder';
import { breadcrumbsFor } from '../../lib/companyFiles';
import { companyFilesService, type CompanyEntry } from '../../services/companyFilesService';
import { CompanyFileRow } from './CompanyFileRow';
import { NewFolderDialog } from './NewFolderDialog';

interface CompanyFilesBrowserProps {
  /** Pasta aberta (null = pastas atribuídas). */
  path: string | null;
  onNavigate: (path: string | null) => void;
  onOpenFile: (entry: CompanyEntry) => void;
  onDownload: (entry: CompanyEntry) => void;
}

/** Navegação nas pastas do servidor de ficheiros atribuídas ao colaborador. */
export const CompanyFilesBrowser: React.FC<CompanyFilesBrowserProps> = ({
  path,
  onNavigate,
  onOpenFile,
  onDownload,
}) => {
  const queryClient = useQueryClient();
  const roots = useCompanyFolder(null);
  const folder = useCompanyFolder(path, path !== null);
  const listing = path === null ? roots : folder;
  const [creating, setCreating] = useState(false);

  const folders = (roots.data?.entries ?? []).map(entry => ({
    path: entry.path,
    name: entry.name,
  }));
  const crumbs = breadcrumbsFor(path, folders);
  const canEdit = listing.data?.permission === 'edit';

  const createFolder = async (name: string) => {
    if (!path) return null;
    const { data, error } = await companyFilesService.createFolder(`${path}/${name}`);
    if (error || !data) return error;
    if (!data.created) return 'Já existe uma pasta com esse nome.';
    await queryClient.invalidateQueries({ queryKey: companyFolderKey(path) });
    return null;
  };

  const open = (entry: CompanyEntry) =>
    entry.type === 'dir' ? onNavigate(entry.path) : onOpenFile(entry);

  return (
    <section className="rounded-[28px] bg-white p-3 shadow-rz-soft ring-1 ring-rz-line md:p-5">
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
        {path && listing.data?.permission === 'read' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rz-canvas px-3 py-1 text-[12px] font-semibold text-rz-muted">
            <Eye className="h-3.5 w-3.5" /> Só leitura
          </span>
        )}
        {path && canEdit && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-canvas px-4 text-[13px] font-semibold text-rz-ink ring-1 ring-rz-line hover:bg-rz-primary-soft"
          >
            <FolderPlus className="h-4 w-4 text-rz-primary" /> Nova pasta
          </button>
        )}
      </div>

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
              ? 'Esta pasta está vazia.'
              : 'Ainda não tem pastas da empresa atribuídas. Peça acesso ao administrador.'}
          </p>
        </div>
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

      <NewFolderDialog open={creating} onClose={() => setCreating(false)} onCreate={createFolder} />
    </section>
  );
};
