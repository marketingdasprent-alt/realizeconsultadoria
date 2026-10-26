import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pdfFirstPage } from '@/modules/webmail/lib/pdfThumb';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import { fileTypeLabel, formatBytes } from '../../lib/files';
import type { ChatMessage } from '../../types';

// A 1.ª página de cada PDF desenha-se uma vez por sessão (o URL assinado muda, o ficheiro não).
const pdfPages = new Map<string, Promise<string | null>>();
const pdfPreview = (key: string, url: string) => {
  let page = pdfPages.get(key);
  if (!page) {
    page = fetch(url)
      .then(response => (response.ok ? response.blob() : Promise.reject(response.status)))
      .then(blob => pdfFirstPage(blob, 320))
      .catch(() => null);
    pdfPages.set(key, page);
  }
  return page;
};

/** PDF: a primeira página em miniatura, por cima do nome. */
const PdfPreview: React.FC<{ cacheKey: string; url: string; name: string }> = ({
  cacheKey,
  url,
  name,
}) => {
  const [page, setPage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    pdfPreview(cacheKey, url).then(result => alive && setPage(result));
    return () => {
      alive = false;
    };
  }, [cacheKey, url]);
  if (!page) return null;
  return (
    <img
      src={page}
      alt={`Primeira página de ${name}`}
      className="mb-2.5 h-40 w-full rounded-xl bg-white object-cover object-top"
    />
  );
};

/** Ficheiro (PDF, Word, Excel…): nome, tipo e tamanho; descarrega com URL temporário. */
export const FileAttachment: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const url = useAttachmentUrl(message);
  const attachment = message.attachment;
  if (!attachment) return null;
  const mine = message.isMine;
  const ready = !!url && !message.pending;
  const isWaiting = !url && (!!attachment.path || !!message.pending);
  const isPdf =
    attachment.mime === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');

  return (
    <a
      href={ready ? (url as string) : undefined}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={cn('block w-[16rem] max-w-full', !ready && 'pointer-events-none')}
      aria-label={`Descarregar ${attachment.name}`}
    >
      {isPdf && url && (
        <PdfPreview
          cacheKey={attachment.path ?? message.localUrl ?? url}
          url={url}
          name={attachment.name}
        />
      )}
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            mine ? 'bg-white/20' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
          )}
        >
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{attachment.name}</span>
          <span className={cn('text-xs', mine ? 'text-white/70' : 'text-rz-muted')}>
            {fileTypeLabel(attachment.mime, attachment.name)} · {formatBytes(attachment.size)}
          </span>
        </span>
        {!isWaiting ? (
          <Download className="ml-1 h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <Loader2 className="ml-1 h-4 w-4 shrink-0 animate-spin opacity-70" />
        )}
      </span>
    </a>
  );
};
