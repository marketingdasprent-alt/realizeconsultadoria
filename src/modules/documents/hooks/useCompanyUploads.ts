import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { companyFilesService } from '../services/companyFilesService';
import { companyFolderKey } from './useCompanyFolder';

export interface CompanyUpload {
  id: string;
  name: string;
  /** 0 a 1. */
  progress: number;
  error: string | null;
  done: boolean;
}

/** Tempo que um envio concluído fica visível na lista. */
const DONE_VISIBLE_MS = 4000;

/**
 * Ficheiros a carregar numa pasta do servidor, um de cada vez, com o progresso de cada um.
 * Os que correm bem saem da lista passado um bocado; os erros ficam até serem fechados.
 */
export const useCompanyUploads = (folder: string | null) => {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CompanyUpload[]>([]);

  const patch = useCallback(
    (id: string, change: Partial<CompanyUpload>) =>
      setItems(list => list.map(item => (item.id === id ? { ...item, ...change } : item))),
    []
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (!folder || !files.length) return;
      const queued = files.map(file => ({ file, id: crypto.randomUUID() }));
      setItems(list => [
        ...list,
        ...queued.map(({ file, id }) => ({
          id,
          name: file.name,
          progress: 0,
          error: null,
          done: false,
        })),
      ]);
      for (const { file, id } of queued) {
        const { data, error } = await companyFilesService.upload(folder, file, ratio =>
          patch(id, { progress: ratio })
        );
        if (error || !data) {
          patch(id, { error: error ?? 'Não foi possível carregar o ficheiro.' });
          continue;
        }
        patch(id, { done: true, progress: 1, name: data.name });
        queryClient.invalidateQueries({ queryKey: companyFolderKey(folder) });
      }
      setTimeout(() => setItems(list => list.filter(item => !item.done)), DONE_VISIBLE_MS);
    },
    [folder, patch, queryClient]
  );

  const dismiss = useCallback(
    (id: string) => setItems(list => list.filter(item => item.id !== id)),
    []
  );

  return { items, upload, dismiss };
};
