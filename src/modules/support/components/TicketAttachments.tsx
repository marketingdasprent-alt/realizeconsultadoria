import React, { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { ImageLightbox } from '@/modules/social/components/feed/ImageLightbox';
import { useFileUrl } from '@/modules/social/hooks/useFileUrl';
import type { FeedAttachment } from '@/modules/social/types';
import type { TicketAttachment } from '../lib/ticketRules';
import { supportService } from '../services/supportService';
import { TicketAttachmentChip } from './TicketAttachmentChip';

// Os URLs assinados duram 5 min; guardamos 4 para as miniaturas não pedirem outro a cada render.
const cache = new Map<string, { url: string | null; at: number }>();
const resolveTicketUrl = async (path: string) => {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 4 * 60_000) return hit.url;
  const url = await supportService.getAttachmentUrl(path);
  cache.set(path, { url, at: Date.now() });
  return url;
};

const toGallery = (file: TicketAttachment): FeedAttachment => ({
  path: file.file_path,
  name: file.file_name,
  size: file.file_size,
  mime: file.content_type,
});

const Thumb: React.FC<{ file: TicketAttachment; onOpen: () => void }> = ({ file, onOpen }) => {
  const url = useFileUrl(file.file_path, resolveTicketUrl);
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={file.file_name}
      aria-label={`Ver ${file.file_name}`}
      className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-rz-canvas ring-1 ring-black/5 transition-transform hover:scale-[1.03]"
    >
      {url && !broken ? (
        <img
          src={url}
          alt={file.file_name}
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : broken ? (
        <ImageOff className="h-5 w-5 text-rz-muted" />
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-rz-muted" />
      )}
    </button>
  );
};

/** Anexos de um ticket: imagens em miniatura (abrem em galeria) e os outros em lista. */
export const TicketAttachments: React.FC<{ files: TicketAttachment[] }> = ({ files }) => {
  const [open, setOpen] = useState<number | null>(null);
  const images = files.filter(file => file.content_type.startsWith('image/'));
  const others = files.filter(file => !file.content_type.startsWith('image/'));

  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((file, index) => (
            <Thumb key={file.id} file={file} onOpen={() => setOpen(index)} />
          ))}
        </div>
      )}
      {others.map(file => (
        <TicketAttachmentChip key={file.id} attachment={file} />
      ))}
      <ImageLightbox
        images={images.map(toGallery)}
        index={open}
        onIndex={setOpen}
        resolveUrl={resolveTicketUrl}
      />
    </div>
  );
};
