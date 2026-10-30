import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Folder } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import type { AiFoundFile } from '../services/aiService';

/** Ficheiros e pastas que a Realize IA encontrou no servidor: abrem na página Documentos. */
export const FoundFiles: React.FC<{ files: AiFoundFile[] }> = ({ files }) => {
  const { basePath } = useWorkspace();
  const linkFor = (file: AiFoundFile) => {
    const params = new URLSearchParams();
    if (file.type === 'dir') params.set('pasta', file.path);
    else {
      params.set('pasta', file.path.slice(0, file.path.lastIndexOf('/')));
      params.set('abrir', file.path);
    }
    return `${basePath}/documentos?${params.toString()}`;
  };
  return (
    <div className="ml-9 mt-2 grid max-w-[85%] gap-1.5 sm:grid-cols-2">
      {files.map(file => {
        const Icon = file.type === 'dir' ? Folder : FileText;
        const folder = file.path.split('/').slice(0, -1).join(' / ');
        return (
          <Link
            key={file.path}
            to={linkFor(file)}
            title={file.path}
            className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-white px-3 py-2 ring-1 ring-rz-line transition-colors hover:bg-rz-primary-soft hover:ring-rz-primary/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rz-primary-soft text-rz-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{file.name}</span>
              <span className="block truncate text-[11.5px] text-rz-muted">{folder}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
};
