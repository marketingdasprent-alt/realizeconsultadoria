import React, { useState } from 'react';
import { Folder, FolderPlus, Loader2, Trash2 } from 'lucide-react';
import { useEmployeeFolders } from '../../hooks/useEmployeeFolders';
import type { FolderPermission } from '../../services/folderAccessService';
import { FileSection } from './files/FileRow';
import { PermissionToggle } from './folders/PermissionToggle';
import { ServerFolderPicker } from './folders/ServerFolderPicker';

interface EmployeeFoldersTabProps {
  employeeId: string;
}

/**
 * Pastas do servidor de ficheiros que o colaborador vê em Documentos (com ler ou editar). O
 * acesso a uma pasta inclui as subpastas.
 */
const EmployeeFoldersTab: React.FC<EmployeeFoldersTabProps> = ({ employeeId }) => {
  const { folders, isLoading, assign, setPermission, remove } = useEmployeeFolders(employeeId);
  const [picking, setPicking] = useState(false);

  return (
    <FileSection
      title="Pastas da empresa"
      description="O que o colaborador vê em Documentos (servidor de ficheiros). Dar acesso a uma pasta inclui as subpastas."
      count={folders.length}
      action={
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
        >
          <FolderPlus className="h-4 w-4" /> Adicionar pasta
        </button>
      }
    >
      {isLoading ? (
        <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />
      ) : !folders.length ? (
        <p className="px-2 py-6 text-center text-[13.5px] text-rz-muted">
          Ainda sem pastas. Em "Adicionar pasta" escolha (ou crie) as pastas a que tem acesso.
        </p>
      ) : (
        <ul>
          {folders.map(folder => (
            <li
              key={folder.id}
              className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-rz-canvas"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Folder className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  {folder.label || folder.path.split('/').pop()}
                </p>
                <p className="truncate text-[12.5px] text-rz-muted">{folder.path}</p>
              </div>
              <PermissionToggle
                size="sm"
                value={folder.permission as FolderPermission}
                onChange={value => setPermission(folder.id, value)}
              />
              <button
                type="button"
                onClick={() => remove(folder.id)}
                aria-label={`Retirar acesso a ${folder.path}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ServerFolderPicker
        open={picking}
        onClose={() => setPicking(false)}
        assigned={folders.map(folder => folder.path)}
        onPick={assign}
      />
    </FileSection>
  );
};

export default EmployeeFoldersTab;
