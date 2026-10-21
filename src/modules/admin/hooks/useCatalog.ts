import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogService, type CatalogItem, type CatalogKind } from '../services/catalogService';

const unwrap = async <T>(promise: Promise<{ data: T; error: unknown }>): Promise<T> => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

const mustSucceed = async (promise: Promise<{ error: unknown }>) => {
  const { error } = await promise;
  if (error) throw error;
};

/** Uma lista gerida (departamentos ou funções) com criar, mudar o nome e apagar. */
export const useCatalog = (kind: CatalogKind) => {
  const queryClient = useQueryClient();
  const key = ['admin', 'catalog', kind];

  const items = useQuery({
    queryKey: key,
    queryFn: () => unwrap(catalogService.list(kind)),
    // Sempre atual ao abrir (são listas pequenas): mudanças noutro sítio aparecem logo.
    staleTime: 0,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['admin', 'catalog-usage', kind] });
  };

  const create = useMutation({
    mutationFn: async (name: string): Promise<CatalogItem> => {
      const { data, error } = await catalogService.create(kind, name);
      if (error || !data) throw error ?? new Error('Não foi possível criar.');
      return data;
    },
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      mustSucceed(catalogService.rename(kind, id, name)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => mustSucceed(catalogService.remove(kind, id)),
    onSuccess: refresh,
  });

  return { items: items.data ?? [], isLoading: items.isLoading, create, rename, remove };
};

/** Quantos colaboradores usam cada nome (para a gestão das listas). */
export const useCatalogUsage = (kind: CatalogKind) =>
  useQuery({
    queryKey: ['admin', 'catalog-usage', kind],
    queryFn: () => unwrap(catalogService.usage(kind)),
    staleTime: 0,
  });
