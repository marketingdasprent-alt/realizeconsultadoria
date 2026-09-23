import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeDocument } from '@/lib/documents';
import { documentService } from '../services/documentService';

interface UseDocumentDownloadResult {
  openingId: string | null;
  /** Abre o ficheiro num separador novo (funciona em PWA/iOS, ao contrário do download forçado). */
  open: (doc: Pick<EmployeeDocument, 'id' | 'file_path' | 'file_name'>) => Promise<void>;
}

export const useDocumentDownload = (): UseDocumentDownloadResult => {
  const { toast } = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = useCallback(
    async (doc: Pick<EmployeeDocument, 'id' | 'file_path' | 'file_name'>) => {
      setOpeningId(doc.id);
      // Abrir a janela antes do await evita o bloqueio de pop-ups no iOS.
      const win = window.open('', '_blank');
      const { url, error } = await documentService.getSignedUrl(doc.file_path);
      setOpeningId(null);
      if (!url) {
        win?.close();
        toast({
          title: 'Não foi possível abrir o documento',
          description: error?.message,
          variant: 'destructive',
        });
        return;
      }
      if (win) win.location.href = url;
      else window.location.href = url;
    },
    [toast]
  );

  return { openingId, open };
};
