import React from 'react';
import { ImageIcon } from 'lucide-react';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import { useImageViewer } from '../ImageViewerContext';
import type { ChatMessage } from '../../types';

/** Fotografia com pré-visualização; ao tocar abre na galeria da conversa. */
export const ImageAttachment: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const url = useAttachmentUrl(message);
  const openViewer = useImageViewer();
  const name = message.attachment?.name ?? 'Imagem';

  if (!url) {
    return (
      <span className="flex h-40 w-56 items-center justify-center rounded-2xl bg-black/5">
        <ImageIcon className="h-8 w-8 animate-pulse opacity-40" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        if (message.pending) return;
        if (openViewer) openViewer(message.id);
        else window.open(url, '_blank', 'noreferrer');
      }}
      className="-mx-2 -mt-1 block cursor-zoom-in"
      aria-label={`Abrir ${name}`}
    >
      <img
        src={url}
        alt={name}
        loading="lazy"
        className="max-h-72 w-auto max-w-full rounded-2xl object-cover"
      />
    </button>
  );
};
