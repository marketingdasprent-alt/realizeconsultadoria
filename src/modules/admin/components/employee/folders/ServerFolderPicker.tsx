import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Folder, HardDrive, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { folderAccessService, type FolderPermission } from '../../../services/folderAccessService';
import { NewServerFolder } from './NewServerFolder';
import { PermissionToggle } from './PermissionToggle';

interface ServerFolderPickerProps {
  open: boolean;
  onClose: () => void;
  /** Pastas que o colaborador já tem (aparecem marcadas). */
  assigned: string[];
  /** Dá acesso; devolve a mensagem de erro, ou null se correu bem. */
  onPick: (path: string, permission: FolderPermission) => Promise<string | null>;
}

const browseKey = (path: string | null) => ['admin', 'server-folders', path ?? ''] as const;

/**
 * Explorador das pastas do servidor (D:\Shares): navegar, criar uma pasta nova e dar acesso à
 * pasta aberta, para ler ou editar. Dar acesso a uma pasta inclui as subpastas.
 */
export const ServerFolderPicker: React.FC<ServerFolderPickerProps> = ({
  open,
  onClose,
  assigned,
  onPick,
}) => {
  const qc = useQueryClient();
  const [path, setPath] = useState<string | null>(null);
  const [permission, setPermission] = useState<FolderPermission>('read');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPath(null);
      setPermission('read');
      setError(null);
    }
  }, [open]);

  const listing = useQuery({
    queryKey: browseKey(path),
    enabled: open,
    queryFn: async () => {
      const { data, error: browseError } = await folderAccessService.browse(path);
      if (browseError || !data) throw new Error(browseError ?? '');
      return data.entries;
    },
  });

  const segments = path ? path.split('/') : [];
  const give = async () => {
    if (!path || isSaving) return;
    setIsSaving(true);
    const message = await onPick(path, permission);
    setIsSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogTitle className="text-[18px] font-extrabold">Dar acesso a uma pasta</DialogTitle>
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-0.5 text-[13px]">
          <button
            type="button"
            onClick={() => setPath(null)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            <HardDrive className="h-3.5 w-3.5" /> Servidor
          </button>
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-3.5 w-3.5 text-rz-muted" />
              <button
                type="button"
                onClick={() => setPath(segments.slice(0, index + 1).join('/'))}
                className="max-w-[12rem] truncate rounded-full px-2 py-1 font-semibold hover:bg-rz-canvas"
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </nav>

        <div className="max-h-[45vh] min-h-[10rem] overflow-y-auto rounded-2xl bg-rz-canvas/60 p-1.5">
          {listing.isLoading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-rz-primary" />
          ) : listing.error ? (
            <p className="px-3 py-8 text-center text-[13px] text-rose-600">
              {listing.error.message || 'Não foi possível abrir esta pasta.'}
            </p>
          ) : !listing.data?.length ? (
            <p className="px-3 py-8 text-center text-[13px] text-rz-muted">Sem subpastas.</p>
          ) : (
            <ul>
              {listing.data.map(folder => (
                <li key={folder.path}>
                  <button
                    type="button"
                    onClick={() => setPath(folder.path)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-semibold hover:bg-white"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    {assigned.includes(folder.path) && (
                      <span className="text-[11.5px] font-bold text-emerald-600">Com acesso</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-rz-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {path && (
          <NewServerFolder
            parent={path}
            onCreated={created => {
              void qc.invalidateQueries({ queryKey: browseKey(path) });
              setPath(created);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-rz-line pt-3">
          <PermissionToggle value={permission} onChange={setPermission} />
          <button
            type="button"
            onClick={give}
            disabled={!path || isSaving}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {path ? 'Dar acesso a esta pasta' : 'Escolha uma pasta'}
          </button>
          {error && <p className="w-full text-[13px] text-rose-600">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
