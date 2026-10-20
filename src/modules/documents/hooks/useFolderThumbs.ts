import { useQueries } from '@tanstack/react-query';
import { hasThumbnail } from '../lib/companyFiles';
import { companyFilesService, type CompanyEntry } from '../services/companyFilesService';

/** Pedidos de 9 em 9: as primeiras miniaturas aparecem sem esperar pelas da pasta toda. */
const CHUNK = 9;

/**
 * Miniaturas dos ficheiros de uma pasta (vista em grelha). Cada grupo chega quando estiver
 * pronto; um ficheiro alterado (outra data/tamanho) pede outra.
 */
export const useFolderThumbs = (entries: CompanyEntry[], enabled: boolean) => {
  const files = entries.filter(hasThumbnail);
  const chunks: CompanyEntry[][] = [];
  for (let index = 0; index < files.length; index += CHUNK)
    chunks.push(files.slice(index, index + CHUNK));

  const results = useQueries({
    queries: chunks.map(chunk => ({
      queryKey: [
        'company-files',
        'thumbs',
        chunk.map(file => `${file.path}|${file.modified}|${file.size}`).join('/'),
      ],
      enabled,
      // Os links valem 6 h no servidor.
      staleTime: 5 * 3600_000,
      queryFn: async () => {
        const { data, error } = await companyFilesService.thumbs(
          chunk.map(({ path, modified, size }) => ({ path, modified, size }))
        );
        if (error) throw new Error(error);
        return data ?? {};
      },
    })),
  });

  return Object.assign({}, ...results.map(result => result.data ?? {})) as Record<
    string,
    string | null
  >;
};
