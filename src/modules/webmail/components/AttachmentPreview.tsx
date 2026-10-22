import React, { useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { loadAttachment, previewKind, type LoadedAttachment } from '../lib/attachments';
import { mailErrorText, type MailError } from '../services/mailService';
import type { MailAttachmentInfo } from '../types';

export interface PreviewTarget {
  accountId: string;
  messageId: string;
  attachment: MailAttachmentInfo;
}

interface AttachmentPreviewProps {
  target: PreviewTarget | null;
  onClose: () => void;
  onDownload: (target: PreviewTarget) => void;
}

const MAX_TEXT_CHARS = 200_000;

/** Abre o anexo dentro do Realize (imagem, PDF, vídeo, áudio, texto); o resto descarrega-se. */
export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  target,
  onClose,
  onDownload,
}) => {
  const [loaded, setLoaded] = useState<LoadedAttachment | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const kind = target ? previewKind(target.attachment.mime, target.attachment.filename) : null;

  useEffect(() => {
    setLoaded(null);
    setUrl(null);
    setText(null);
    setError(null);
    if (!target || !kind) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    loadAttachment(target.accountId, target.messageId, target.attachment.id)
      .then(async result => {
        if (cancelled) return;
        if (kind === 'text') setText((await result.blob.text()).slice(0, MAX_TEXT_CHARS));
        else {
          objectUrl = URL.createObjectURL(result.blob);
          setUrl(objectUrl);
        }
        setLoaded(result);
      })
      .catch(err => {
        if (!cancelled)
          setError(mailErrorText(err as MailError) || 'Não foi possível abrir o anexo.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target, kind, attempt]);

  if (!target) return null;
  const { attachment } = target;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex h-[min(86vh,820px)] flex-col gap-3 rounded-[28px] p-5 sm:max-w-4xl sm:rounded-[28px]">
        <div className="flex items-center gap-3 pr-8">
          <DialogTitle className="min-w-0 flex-1 truncate text-[16px] font-extrabold">
            {attachment.filename}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onDownload(target)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
          >
            <Download className="h-4 w-4" /> Descarregar
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl bg-rz-canvas">
          {!kind ? (
            <p className="px-6 text-center text-[14px] text-rz-muted">
              Este tipo de ficheiro não se pode ver aqui. Use “Descarregar”.
            </p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p className="text-[14px] text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => setAttempt(n => n + 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold ring-1 ring-rz-line"
              >
                <RefreshCw className="h-4 w-4" /> Tentar outra vez
              </button>
            </div>
          ) : !loaded ? (
            <Loader2 className="h-7 w-7 animate-spin text-rz-primary" />
          ) : kind === 'image' && url ? (
            <img
              src={url}
              alt={attachment.filename}
              className="max-h-full max-w-full object-contain"
            />
          ) : kind === 'pdf' && url ? (
            <iframe
              src={url}
              title={attachment.filename}
              className="h-full w-full border-0 bg-white"
            />
          ) : kind === 'video' && url ? (
            <video src={url} controls className="max-h-full max-w-full" />
          ) : kind === 'audio' && url ? (
            <audio src={url} controls className="w-full max-w-md" />
          ) : kind === 'text' && text !== null ? (
            <pre className="h-full w-full overflow-auto whitespace-pre-wrap bg-white p-4 text-left font-mono text-[12.5px]">
              {text}
            </pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
