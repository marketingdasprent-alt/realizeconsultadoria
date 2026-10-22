import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileTypeLabel, formatBytes } from '@/modules/messenger/lib/files';
import { useFileUrl } from '../../hooks/useFileUrl';
import type { FeedAttachment } from '../../types';
import { ImageLightbox } from './ImageLightbox';

const ImageTile: React.FC<{ file: FeedAttachment; tall: boolean; onOpen: () => void }> = ({
  file,
  tall,
  onOpen,
}) => {
  const url = useFileUrl(file.path);
  return (
    // Abre a galeria (visor dentro do Realize), nunca um novo separador.
    <button
      type="button"
      data-protected-image
      onClick={onOpen}
      aria-label={`Ver ${file.name}`}
      className={cn(
        'block w-full cursor-zoom-in select-none overflow-hidden rounded-2xl bg-rz-canvas',
        tall ? 'h-72' : 'h-40'
      )}
    >
      {url && (
        <img
          src={url}
          alt={file.name}
          loading="lazy"
          draggable={false}
          className="pointer-events-none h-full w-full object-cover [-webkit-touch-callout:none]"
        />
      )}
    </button>
  );
};

const FileChip: React.FC<{ file: FeedAttachment }> = ({ file }) => {
  const url = useFileUrl(file.path);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      download={file.name}
      className="flex items-center gap-3 rounded-2xl bg-rz-canvas p-3 transition-colors hover:bg-rz-primary-soft"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{file.name}</span>
        <span className="text-xs text-rz-muted">
          {fileTypeLabel(file.mime, file.name)} · {formatBytes(file.size)}
        </span>
      </span>
      <Download className="h-4 w-4 text-rz-muted" />
    </a>
  );
};

/** Imagens em grelha e documentos em linhas. */
export const PostAttachments: React.FC<{ attachments: FeedAttachment[] }> = ({ attachments }) => {
  const images = attachments.filter(file => file.mime.startsWith('image/'));
  const files = attachments.filter(file => !file.mime.startsWith('image/'));
  const [open, setOpen] = useState<number | null>(null);
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={cn('grid gap-2', images.length > 1 && 'grid-cols-2')}>
          {images.map((file, index) => (
            <ImageTile
              key={file.path}
              file={file}
              tall={images.length === 1}
              onOpen={() => setOpen(index)}
            />
          ))}
        </div>
      )}
      <ImageLightbox images={images} index={open} onIndex={setOpen} />
      {files.map(file => (
        <FileChip key={file.path} file={file} />
      ))}
    </div>
  );
};
