import { useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { addTicketFiles } from '../lib/ticketFiles';

/** Ficheiros escolhidos para um pedido ou resposta (até 5, 10 MB, imagens ou PDF). */
export const useTicketFiles = () => {
  const [files, setFiles] = useState<File[]>([]);

  const add = useCallback(
    (incoming: File[]) => {
      const { files: next, errors } = addTicketFiles(files, incoming);
      setFiles(next);
      if (errors.length)
        toast({
          title: 'Alguns ficheiros não entraram',
          description: errors.join(' '),
          variant: 'destructive',
        });
    },
    [files]
  );

  return {
    files,
    add,
    remove: (index: number) => setFiles(current => current.filter((_, i) => i !== index)),
    clear: () => setFiles([]),
  };
};
