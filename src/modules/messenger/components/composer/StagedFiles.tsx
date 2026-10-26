import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { pdfFirstPage } from '@/modules/webmail/lib/pdfThumb';
import { formatBytes } from '../../lib/files';

const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

/** Miniatura de um ficheiro ainda por enviar: a imagem, a 1.ª página do PDF ou o ícone. */
const StagedThumb: React.FC<{ file: File }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    if (file.type.startsWith('image/')) {
      created = URL.createObjectURL(file);
      setUrl(created);
    } else if (isPdf(file)) {
      pdfFirstPage(file, 160)
        .then(page => alive && setUrl(page))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file]);

  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover object-top" />
  ) : (
    <FileText className="h-6 w-6 text-rz-primary" />
  );
};

interface StagedFilesProps {
  files: File[];
  onRemove: (index: number) => void;
}

/** Anexos escolhidos (ou largados) antes de enviar: dá para escrever a mensagem junto. */
export const StagedFiles: React.FC<StagedFilesProps> = ({ files, onRemove }) =>
  files.length ? (
    <ul className="flex gap-2 overflow-x-auto px-2 pb-1.5 pt-1" aria-label="Anexos a enviar">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${index}`}
          className="relative w-[92px] shrink-0 overflow-hidden rounded-2xl bg-rz-canvas ring-1 ring-rz-line"
          title={file.name}
        >
          <span className="flex h-[64px] items-center justify-center overflow-hidden bg-white">
            <StagedThumb file={file} />
          </span>
          <span className="block truncate px-2 pt-1 text-[11px] font-semibold">{file.name}</span>
          <span className="block px-2 pb-1.5 text-[10px] text-rz-muted">
            {formatBytes(file.size)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
            aria-label={`Tirar ${file.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  ) : null;
