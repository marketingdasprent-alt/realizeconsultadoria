import { useQuery } from '@tanstack/react-query';
import { sortEntries } from '../lib/companyFiles';
import { companyFilesService, type CompanyListing } from '../services/companyFilesService';

export const companyFolderKey = (path: string | null) => ['company-files', path ?? ''] as const;

/**
 * Conteúdo de uma pasta do servidor de ficheiros. Sem caminho (null), devolve as pastas
 * atribuídas ao colaborador, como se fossem as pastas de topo.
 */
export const useCompanyFolder = (path: string | null, enabled = true) =>
  useQuery({
    queryKey: companyFolderKey(path),
    enabled,
    queryFn: async (): Promise<CompanyListing> => {
      if (path === null) {
        const { data, error } = await companyFilesService.folders();
        if (error || !data) throw new Error(error ?? '');
        return {
          path: null,
          permission: null,
          truncated: false,
          entries: data.map(folder => ({ name: folder.name, type: 'dir', path: folder.path })),
        };
      }
      const { data, error } = await companyFilesService.list(path);
      if (error || !data) throw new Error(error ?? '');
      return {
        ...data,
        entries: sortEntries(
          data.entries.map(entry => ({ ...entry, path: `${path}/${entry.name}` }))
        ),
      };
    },
  });
