import React from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import { fileTypeLabel, formatBytes } from '../../lib/files';
import type { ChatMessage } from '../../types';

/** Ficheiro (PDF, Word, Excel…): nome, tipo e tamanho; descarrega com URL temporário. */
export const FileAttachment: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const url = useAttachmentUrl(message);
  const attachment = message.attachment;
  if (!attachment) return null;
  const mine = message.isMine;
  const ready = !!url && !message.pending;
  const isWaiting = !url && (!!attachment.path || !!message.pending);

  return (
    <a
      href={ready ? (url as string) : undefined}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={cn('flex items-center gap-3', !ready && 'pointer-events-none')}
      aria-label={`Descarregar ${attachment.name}`}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          mine ? 'bg-white/20' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
        )}
      >
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[14rem] truncate font-semibold">{attachment.name}</span>
        <span className={cn('text-xs', mine ? 'text-white/70' : 'text-rz-muted')}>
          {fileTypeLabel(attachment.mime, attachment.name)} · {formatBytes(attachment.size)}
        </span>
      </span>
      {!isWaiting ? (
        <Download className="ml-2 h-4 w-4 shrink-0 opacity-70" />
      ) : (
        <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
      )}
    </a>
  );
};
