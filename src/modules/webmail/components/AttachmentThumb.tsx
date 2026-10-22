import React, { useEffect, useState } from 'react';
import { Download, FileArchive, FileSpreadsheet, FileText, File as FileIcon } from 'lucide-react';
import { loadAttachment, previewKind } from '../lib/attachments';
import type { MailAttachmentInfo } from '../types';

interface AttachmentThumbProps {
  accountId: string;
  messageId: string;
  attachment: MailAttachmentInfo;
  /** Só as primeiras pedem a miniatura (cada anexo é um pedido ao servidor). */
  withPreview: boolean;
  onOpen: () => void;
  onDownload: () => void;
}

const kb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

const extensionOf = (name: string) => name.split('.').pop()?.slice(0, 4).toUpperCase() ?? '';

const iconFor = (name: string) => {
  const ext = extensionOf(name);
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return FileSpreadsheet;
  if (['ZIP', 'RAR', '7Z'].includes(ext)) return FileArchive;
  if (['DOC', 'DOCX', 'TXT', 'PDF'].includes(ext)) return FileText;
  return FileIcon;
};

/** Anexo em miniatura pequena: imagem/PDF em pré-visualização, o resto com o ícone do tipo. */
export const AttachmentThumb: React.FC<AttachmentThumbProps> = ({
  accountId,
  messageId,
  attachment,
  withPreview,
  onOpen,
  onDownload,
}) => {
  const kind = previewKind(attachment.mime, attachment.filename);
  const visual = withPreview && (kind === 'image' || kind === 'pdf');
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visual) return;
    let alive = true;
    let created: string | null = null;
    loadAttachment(accountId, messageId, attachment.id)
      .then(loaded => {
        if (!alive) return;
        created = URL.createObjectURL(loaded.blob);
        setUrl(created);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [visual, accountId, messageId, attachment.id]);

  const Icon = iconFor(attachment.filename);
  return (
    <div className="group relative w-[120px] overflow-hidden rounded-2xl bg-rz-canvas ring-1 ring-rz-line hover:ring-rz-primary/40">
      <button
        type="button"
        onClick={onOpen}
        title={attachment.filename}
        className="block w-full text-left"
      >
        <span className="relative flex h-[80px] items-center justify-center overflow-hidden bg-white">
          {url && kind === 'image' ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : url && kind === 'pdf' ? (
            // Primeira página, sem barra nem interação (o clique abre o anexo).
            <iframe
              title={attachment.filename}
              src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              tabIndex={-1}
              className="pointer-events-none h-[240px] w-[360px] origin-top-left scale-[0.334] border-0"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-rz-primary">
              <Icon className="h-7 w-7" />
              <span className="text-[10px] font-bold tracking-wide text-rz-muted">
                {extensionOf(attachment.filename)}
              </span>
            </span>
          )}
        </span>
        <span className="block px-2 py-1.5">
          <span className="block truncate text-[11.5px] font-semibold">{attachment.filename}</span>
          <span className="block text-[10.5px] text-rz-muted">{kb(attachment.size)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDownload}
        title="Descarregar"
        aria-label={`Descarregar ${attachment.filename}`}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rz-muted opacity-0 shadow-sm transition-opacity hover:text-rz-primary focus:opacity-100 group-hover:opacity-100"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
