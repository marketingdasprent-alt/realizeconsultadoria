import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeDocument } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { documentService } from '@/modules/documents/services/documentService';

/** Apagar um documento do colaborador com confirmação (estado do diálogo incluído). */
export const useDocumentRemoval = (onRemoved: () => void) => {
  const { toast } = useToast();
  const [target, setTarget] = useState<EmployeeDocument | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setIsRemoving(true);
    const { error } = await documentService.remove(target);
    setIsRemoving(false);
    if (error) {
      toast({
        title: 'Erro ao apagar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Documento apagado' });
    setTarget(null);
    onRemoved();
  };

  return { target, ask: setTarget, cancel: () => setTarget(null), confirm, isRemoving };
};
