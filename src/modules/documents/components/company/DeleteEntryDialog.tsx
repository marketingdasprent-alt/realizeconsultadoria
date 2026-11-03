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
  /** Admin: elimina logo. Senão fica um pedido que um admin aprova. */
  direct: boolean;
  onClose: () => void;
}

/**
 * Confirmação para eliminar. Admin: o servidor move logo para o lixo (D:\Shares\_Lixo_Realize,
 * 30 dias). Os outros: fica um pedido e os admins são avisados pelo Realize AI.
 */
export const DeleteEntryDialog: React.FC<DeleteEntryDialogProps> = ({
  entry,
  folder,
  direct,
  onClose,
}) => {
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
    const { data, error: message } = await companyFilesService.remove(entry);
    setIsDeleting(false);
    if (message) {
      setError(message);
      return;
    }
    if (data?.requested) {
      toast({
        title: 'Pedido enviado',
        description: 'Um administrador decide no Realize AI. Recebe um aviso com a resposta.',
      });
    } else {
      await queryClient.invalidateQueries({ queryKey: companyFolderKey(folder) });
      toast({ title: `${isFolder ? 'Pasta eliminada' : 'Ficheiro eliminado'}: ${entry.name}` });
    }
    onClose();
  };

  return (
    <Dialog open={!!entry} onOpenChange={next => !next && !isDeleting && onClose()}>
      <DialogContent className="rounded-[28px] sm:max-w-sm sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Trash2 className="h-5 w-5 text-rose-600" />
          {direct ? 'Eliminar' : 'Pedir para eliminar'} {isFolder ? 'pasta' : 'ficheiro'}
        </DialogTitle>
        <p className="break-words text-[14px] text-rz-ink">
          Eliminar <strong>{entry?.name}</strong>
          {isFolder ? ' e tudo o que tem dentro' : ''}?
        </p>
        <p className="text-[13px] text-rz-muted">
          {direct
            ? 'Vai para o lixo do servidor e fica lá 30 dias. Para recuperar, fale com quem gere o servidor.'
            : 'Um administrador tem de aprovar. Até lá continua aqui.'}
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
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {direct ? 'Eliminar' : 'Pedir'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
