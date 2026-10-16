import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Forward, Loader2, Reply, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useMessengerApi } from '../context/useMessengerApi';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';
import type { ChatMessage } from '../types';

interface ImageLightboxProps {
  /** Todas as imagens carregadas da conversa, da mais antiga à mais recente. */
  images: ChatMessage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
}

const ROUND =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 disabled:opacity-30';

/** Guarda a imagem com o nome original (o atributo download não funciona entre origens). */
const saveImage = async (url: string, name: string) => {
  try {
    const blob = await (await fetch(url)).blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } catch {
    toast({ title: 'Não foi possível guardar a imagem', variant: 'destructive' });
  }
};

/** Galeria em ecrã inteiro: anterior/seguinte (setas, deslizar), responder, guardar e encaminhar. */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  index,
  onIndexChange,
  onClose,
  onReply,
  onForward,
}) => {
  const { getFileUrl } = useMessengerApi();
  const message = images[index];
  const url = useAttachmentUrl(message ?? {});
  const touchX = useRef<number | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const go = useCallback(
    (step: number) => {
      const next = index + step;
      if (next >= 0 && next < images.length) onIndexChange(next);
    },
    [index, images.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  // Carrega já as imagens ao lado para a passagem ser instantânea.
  useEffect(() => {
    for (const neighbour of [images[index - 1], images[index + 1]]) {
      const path = neighbour?.attachment?.path;
      if (path)
        void getFileUrl(path).then(signed => {
          if (signed) new Image().src = signed;
        });
    }
  }, [images, index, getFileUrl]);

  if (!message) return null;
  const name = message.attachment?.name ?? 'imagem';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem ${index + 1} de ${images.length}`}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onClick={onClose}
      onTouchStart={event => (touchX.current = event.touches[0].clientX)}
      onTouchEnd={event => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null) return;
        const delta = event.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 60) go(delta > 0 ? -1 : 1);
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 text-white"
        onClick={event => event.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{message.authorName}</p>
          <p className="text-xs text-white/70">
            {format(new Date(message.createdAt), "d 'de' MMMM, HH:mm", { locale: pt })} ·{' '}
            {index + 1} / {images.length}
          </p>
        </div>
        <button
          type="button"
          className={ROUND}
          onClick={() => {
            onClose();
            onReply(message);
          }}
          aria-label="Responder"
          title="Responder"
        >
          <Reply className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={ROUND}
          onClick={() => {
            onClose();
            onForward(message);
          }}
          aria-label="Encaminhar"
          title="Encaminhar"
        >
          <Forward className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={ROUND}
          disabled={!url}
          onClick={() => url && void saveImage(url, name)}
          aria-label="Guardar"
          title="Guardar"
        >
          <Download className="h-5 w-5" />
        </button>
        <button type="button" className={ROUND} onClick={onClose} aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 md:px-16">
        {url ? (
          <img
            key={message.id}
            src={url}
            alt={name}
            onClick={event => event.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        )}
        {hasPrev && (
          <button
            type="button"
            className={`${ROUND} absolute left-2 top-1/2 -translate-y-1/2 md:left-4`}
            onClick={event => {
              event.stopPropagation();
              go(-1);
            }}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            className={`${ROUND} absolute right-2 top-1/2 -translate-y-1/2 md:right-4`}
            onClick={event => {
              event.stopPropagation();
              go(1);
            }}
            aria-label="Seguinte"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      {message.text && (
        <p
          className="mx-auto max-w-2xl px-4 pb-5 text-center text-sm text-white/90"
          onClick={event => event.stopPropagation()}
        >
          {message.text}
        </p>
      )}
    </div>,
    document.body
  );
};
