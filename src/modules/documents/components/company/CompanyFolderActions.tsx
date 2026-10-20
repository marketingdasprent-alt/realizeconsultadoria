import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FolderPlus, Upload } from 'lucide-react';
import { companyFolderKey } from '../../hooks/useCompanyFolder';
import type { NewDocumentKind } from '../../lib/companyFiles';
import { sortEntries } from '../../lib/companyFiles';
import {
  companyFilesService,
  type CompanyEntry,
  type CompanyListing,
} from '../../services/companyFilesService';
import { NewDocumentDialog } from './NewDocumentDialog';
import { NewFolderDialog } from './NewFolderDialog';

interface CompanyFolderActionsProps {
  /** Pasta aberta, com permissão de edição. */
  path: string;
  onOpenFile: (entry: CompanyEntry) => void;
  onUpload: (files: File[]) => void;
}

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-canvas px-4 text-[13px] font-semibold text-rz-ink ring-1 ring-rz-line hover:bg-rz-primary-soft';

/** Novo documento, carregar ficheiros e nova pasta, na pasta aberta. */
export const CompanyFolderActions: React.FC<CompanyFolderActionsProps> = ({
  path,
  onOpenFile,
  onUpload,
}) => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<'document' | 'folder' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: companyFolderKey(path) });

  // Ficheiro ou pasta nova aparece já na lista; a lista do servidor chega em segundo plano.
  const addToList = (entry: CompanyEntry) => {
    queryClient.setQueryData<CompanyListing>(companyFolderKey(path), listing =>
      listing && !listing.entries.some(item => item.path === entry.path)
        ? { ...listing, entries: sortEntries([...listing.entries, entry]) }
        : listing
    );
    void refresh();
  };

  const createFolder = async (name: string) => {
    const { data, error } = await companyFilesService.createFolder(`${path}/${name}`);
    if (error || !data) return error;
    if (!data.created) return 'Já existe uma pasta com esse nome.';
    addToList({ name, type: 'dir', path: data.path, modified: new Date().toISOString() });
    return null;
  };

  // O documento novo abre logo no editor.
  const createDocument = async (name: string, kind: NewDocumentKind) => {
    const { data, error } = await companyFilesService.createDocument(path, name, kind);
    if (error || !data) return error;
    addToList({
      name: data.name,
      type: 'file',
      path: data.path,
      modified: new Date().toISOString(),
    });
    onOpenFile({ name: data.name, type: 'file', path: data.path });
    return null;
  };

  return (
    <>
      <button type="button" onClick={() => setDialog('document')} className={BUTTON}>
        <FilePlus2 className="h-4 w-4 text-rz-primary" /> Novo documento
      </button>
      <button type="button" onClick={() => inputRef.current?.click()} className={BUTTON}>
        <Upload className="h-4 w-4 text-rz-primary" /> Carregar
      </button>
      <button type="button" onClick={() => setDialog('folder')} className={BUTTON}>
        <FolderPlus className="h-4 w-4 text-rz-primary" /> Nova pasta
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        aria-label="Escolher ficheiros para carregar"
        onChange={event => {
          onUpload(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      <NewDocumentDialog
        open={dialog === 'document'}
        onClose={() => setDialog(null)}
        onCreate={createDocument}
      />
      <NewFolderDialog
        open={dialog === 'folder'}
        onClose={() => setDialog(null)}
        onCreate={createFolder}
      />
    </>
  );
};
