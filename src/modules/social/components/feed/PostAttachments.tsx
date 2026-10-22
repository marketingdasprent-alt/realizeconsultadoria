import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileTypeLabel, formatBytes } from '@/modules/messenger/lib/files';
import { feedService } from '../../services/feedService';
import type { FeedAttachment } from '../../types';

/** URL temporário do ficheiro (na pré-visualização o caminho já é um URL local). */
const useFileUrl = (path: string) => {
  const [url, setUrl] = useState<string | null>(path.startsWith('blob:') ? path : null);
  useEffect(() => {
    if (path.startsWith('blob:')) return;
    let alive = true;
    feedService.getFileUrl(path).then(result => alive && setUrl(result.data));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
};

const ImageTile: React.FC<{ file: FeedAttachment; tall: boolean }> = ({ file, tall }) => {
  const url = useFileUrl(file.path);
  return (
    // Só se vê no Feed: sem ligação para abrir a imagem noutro separador.
    <div
      data-protected-image
      className={cn(
        'block select-none overflow-hidden rounded-2xl bg-rz-canvas',
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
    </div>
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
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={cn('grid gap-2', images.length > 1 && 'grid-cols-2')}>
          {images.map(file => (
            <ImageTile key={file.path} file={file} tall={images.length === 1} />
          ))}
        </div>
      )}
      {files.map(file => (
        <FileChip key={file.path} file={file} />
      ))}
    </div>
  );
};
