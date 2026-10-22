import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { formatBytes } from '@/modules/messenger/lib/files';

interface ComposerFilesProps {
  files: File[];
  onRemove: (index: number) => void;
}

const REMOVE =
  'flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80';

/** Miniaturas das imagens (e linhas para os documentos) antes de publicar. */
export const ComposerFiles: React.FC<ComposerFilesProps> = ({ files, onRemove }) => {
  // Um URL local por imagem; libertado quando a lista muda ou a caixa fecha.
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    const created = files.map(file =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    );
    setUrls(created);
    return () => created.forEach(url => url && URL.revokeObjectURL(url));
  }, [files]);

  if (files.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2 md:pl-14">
      {files.map((file, index) => {
        const url = urls[index];
        return (
          <li key={`${file.name}-${file.size}-${index}`} className="relative">
            {url ? (
              <img
                src={url}
                alt={file.name}
                title={file.name}
                className="h-20 w-20 rounded-2xl object-cover ring-1 ring-rz-line"
              />
            ) : (
              <div
                title={file.name}
                className="flex h-20 w-44 items-center gap-2 rounded-2xl bg-rz-canvas px-3 ring-1 ring-rz-line"
              >
                <FileText className="h-5 w-5 shrink-0 text-rz-primary" />
                <span className="min-w-0 text-[12px] font-semibold leading-tight">
                  <span className="line-clamp-2 break-all">{file.name}</span>
                  <span className="font-normal text-rz-muted">{formatBytes(file.size)}</span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className={`absolute right-1 top-1 ${REMOVE}`}
              aria-label={`Retirar ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};
