import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { companyFolderKey } from '../../hooks/useCompanyFolder';
import { companyFilesService, type CompanyEntry } from '../../services/companyFilesService';

interface DeleteEntryDialogProps {
  /** O que eliminar (null = fechado). */
  entry: CompanyEntry | null;
  /** Pasta aberta, para a atualizar no fim. */
  folder: string | null;
  onClose: () => void;
}

/**
 * Confirmação para eliminar (só admins). O servidor não apaga: move para o lixo
 * (D:\Shares\_Lixo_Realize), onde fica 30 dias.
 */
export const DeleteEntryDialog: React.FC<DeleteEntryDialogProps> = ({ entry, folder, onClose }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (entry) setError(null);
  }, [entry]);

  const isFolder = entry?.type === 'dir';

  const confirm = async () => {
    if (!entry || isDeleting) return;
    setIsDeleting(true);
    const { error: message } = await companyFilesService.remove(entry.path);
    setIsDeleting(false);
    if (message) {
      setError(message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: companyFolderKey(folder) });
    toast({ title: `${isFolder ? 'Pasta eliminada' : 'Ficheiro eliminado'}: ${entry.name}` });
    onClose();
  };

  return (
    <Dialog open={!!entry} onOpenChange={next => !next && !isDeleting && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Trash2 className="h-5 w-5 text-rose-600" />
          {isFolder ? 'Eliminar pasta' : 'Eliminar ficheiro'}
        </DialogTitle>
        <p className="break-words text-[14px] text-rz-ink">
          Eliminar <strong>{entry?.name}</strong>
          {isFolder ? ' e tudo o que tem dentro' : ''}?
        </p>
        <p className="text-[13px] text-rz-muted">
          Vai para o lixo do servidor e fica lá 30 dias. Para recuperar, fale com quem gere o
          servidor.
        </p>
        {error && <p className="text-[13px] text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isDeleting}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />} Eliminar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
