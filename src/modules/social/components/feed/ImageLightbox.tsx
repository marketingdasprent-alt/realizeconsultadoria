import React, { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { useFileUrl } from '../../hooks/useFileUrl';
import type { FeedAttachment } from '../../types';

interface ImageLightboxProps {
  images: FeedAttachment[];
  /** Imagem aberta (null = fechada). */
  index: number | null;
  onIndex: (index: number | null) => void;
}

const ARROW =
  'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30';

/** Pré-carrega a vizinha para a passagem ser instantânea. */
const Preload: React.FC<{ file?: FeedAttachment }> = ({ file }) => {
  useFileUrl(file?.path ?? '');
  return null;
};

/** Galeria: a imagem em ecrã cheio, com setas, teclado (← → Esc) e contador. */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, index, onIndex }) => {
  const open = index !== null;
  const current = open ? images[index] : undefined;
  const url = useFileUrl(current?.path ?? '');
  const many = images.length > 1;

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (!many) return;
      if (event.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (event.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, many, onIndex]);

  if (!open || !current) return null;
  return (
    <Dialog.Root open onOpenChange={next => !next && onIndex(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/90" />
        <Dialog.Content
          data-protected-image
          className="fixed inset-0 z-[70] flex select-none items-center justify-center p-4 outline-none sm:p-12"
          onClick={event => event.target === event.currentTarget && onIndex(null)}
        >
          <Dialog.Title className="sr-only">{current.name}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Galeria de imagens da publicação
          </Dialog.Description>
          {url ? (
            <img
              src={url}
              alt={current.name}
              draggable={false}
              className="pointer-events-none max-h-full max-w-full rounded-lg object-contain [-webkit-touch-callout:none]"
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          )}
          <Dialog.Close
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
          {many && (
            <>
              <button
                type="button"
                className={`${ARROW} left-3 sm:left-5`}
                onClick={() => onIndex((index - 1 + images.length) % images.length)}
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className={`${ARROW} right-3 sm:right-5`}
                onClick={() => onIndex((index + 1) % images.length)}
                aria-label="Imagem seguinte"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur">
                {index + 1} / {images.length}
              </span>
              <Preload file={images[(index + 1) % images.length]} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
