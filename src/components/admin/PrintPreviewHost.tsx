import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { closePrintPreview, usePrintPreview } from '@/lib/print-preview';

/**
 * Pré-visualização das impressões do admin (mapa de férias, relatórios, comprovativos):
 * o documento abre por cima da página e imprime-se daqui, sem janelas novas.
 */
export const PrintPreviewHost: React.FC = () => {
  const preview = usePrintPreview();
  const frame = useRef<HTMLIFrameElement>(null);

  if (!preview) return null;

  return (
    <Dialog open onOpenChange={open => !open && closePrintPreview()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[24px] p-0 font-jakarta [&>button:last-child]:hidden">
        <div className="flex items-center gap-3 border-b border-rz-line px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-[17px] font-extrabold">
            {preview.title}
          </DialogTitle>
          <button
            type="button"
            onClick={() => frame.current?.contentWindow?.print()}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-[14px] font-bold text-white transition-colors hover:bg-rz-primary/90"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={closePrintPreview}
            className="flex h-10 w-10 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <iframe
          ref={frame}
          title={preview.title}
          srcDoc={preview.html}
          className="min-h-0 w-full flex-1 bg-[#f4f2ec]"
        />
      </DialogContent>
    </Dialog>
  );
};
