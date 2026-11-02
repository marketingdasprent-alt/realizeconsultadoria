import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface PreviewFile {
  name: string;
  /** Endereço temporário (assinado) do ficheiro. */
  url: string;
}

type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | null;

const KINDS: Record<Exclude<Kind, null>, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'],
  pdf: ['pdf'],
  video: ['mp4', 'webm', 'mov', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'],
  text: ['txt', 'csv', 'log', 'md', 'json', 'xml'],
};

/** Como se mostra um ficheiro dentro do Realize (null: só descarregar). */
const previewKindOf = (name: string): Kind => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return (
    (Object.keys(KINDS) as Exclude<Kind, null>[]).find(kind => KINDS[kind].includes(extension)) ??
    null
  );
};

/** Ver um ficheiro sem sair do Realize: imagem, PDF, vídeo, áudio e texto; o resto descarrega-se. */
export const FilePreviewDialog: React.FC<{ file: PreviewFile | null; onClose: () => void }> = ({
  file,
  onClose,
}) => {
  const kind = file ? previewKindOf(file.name) : null;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    if (!file || kind !== 'text') return;
    let alive = true;
    fetch(file.url)
      .then(response => response.text())
      .then(body => alive && setText(body.slice(0, 200_000)))
      .catch(() => alive && setText('Não foi possível mostrar o texto.'));
    return () => {
      alive = false;
    };
  }, [file, kind]);

  return (
    <Dialog open={!!file} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex h-[88dvh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-[24px] p-0">
        <div className="flex items-center gap-3 border-b border-rz-line px-5 py-3 pr-12">
          <DialogTitle className="min-w-0 flex-1 truncate text-[15px] font-bold">
            {file?.name}
          </DialogTitle>
          {file && (
            <a
              href={file.url}
              download={file.name}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rz-canvas px-3 text-[13px] font-semibold hover:bg-rz-primary-soft hover:text-rz-primary"
            >
              <Download className="h-4 w-4" /> Descarregar
            </a>
          )}
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-rz-canvas">
          {file && kind === 'image' && (
            <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
          )}
          {file && kind === 'pdf' && (
            <iframe src={file.url} title={file.name} className="h-full w-full bg-white" />
          )}
          {file && kind === 'video' && (
            <video src={file.url} controls className="max-h-full max-w-full" />
          )}
          {file && kind === 'audio' && <audio src={file.url} controls className="w-2/3" />}
          {file &&
            kind === 'text' &&
            (text === null ? (
              <Loader2 className="h-6 w-6 animate-spin text-rz-primary" />
            ) : (
              <pre className="h-full w-full overflow-auto whitespace-pre-wrap bg-white p-5 text-[13px]">
                {text}
              </pre>
            ))}
          {file && !kind && (
            <div className="space-y-3 text-center">
              <FileText className="mx-auto h-10 w-10 text-rz-muted" />
              <p className="text-[14px] text-rz-muted">
                Este tipo de ficheiro não se vê aqui. Descarregue para o abrir.
              </p>
              <a
                href={file.url}
                download={file.name}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-[14px] font-bold text-white"
              >
                <Download className="h-4 w-4" /> Descarregar
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
