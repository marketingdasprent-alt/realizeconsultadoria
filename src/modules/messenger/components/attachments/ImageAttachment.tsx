import React from 'react';
import { ImageIcon } from 'lucide-react';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import type { ChatMessage } from '../../types';

/** Fotografia com pré-visualização; abre em tamanho real num separador novo. */
export const ImageAttachment: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const url = useAttachmentUrl(message);
  const name = message.attachment?.name ?? 'Imagem';

  if (!url) {
    return (
      <span className="flex h-40 w-56 items-center justify-center rounded-2xl bg-black/5">
        <ImageIcon className="h-8 w-8 animate-pulse opacity-40" />
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="-mx-2 -mt-1 block" aria-label={name}>
      <img
        src={url}
        alt={name}
        loading="lazy"
        className="max-h-72 w-auto max-w-full rounded-2xl object-cover"
      />
    </a>
  );
};
