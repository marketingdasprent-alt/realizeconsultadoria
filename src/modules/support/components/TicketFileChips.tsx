import React from 'react';
import { FileText, ImageIcon, X } from 'lucide-react';
import { formatBytes } from '@/modules/messenger/lib/files';

/** Ficheiros escolhidos (ainda não enviados), com tamanho e botão para tirar. */
export const TicketFileChips: React.FC<{ files: File[]; onRemove: (index: number) => void }> = ({
  files,
  onRemove,
}) =>
  files.length ? (
    <ul className="flex flex-wrap gap-2">
      {files.map((file, index) => {
        const Icon = file.type.startsWith('image/') ? ImageIcon : FileText;
        return (
          <li
            key={`${file.name}-${index}`}
            className="flex items-center gap-1.5 rounded-full bg-rz-canvas py-1 pl-3 pr-1 text-[12.5px] font-semibold"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-rz-muted" />
            <span className="max-w-[180px] truncate">{file.name}</span>
            <span className="font-normal text-rz-muted">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
              aria-label={`Tirar ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;
