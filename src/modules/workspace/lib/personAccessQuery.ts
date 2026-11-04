import type { QueryClient } from '@tanstack/react-query';
import { personAccessService } from '../services/personAccessService';

export const accessKey = (userId: string | undefined) => ['person-access', userId] as const;

/** Pastas e caixas de email de uma pessoa (só administradores). */
export const fetchAccess = async (userId: string) => {
  const { data, error } = await personAccessService.overview(userId);
  if (error || !data) throw new Error(error ?? '');
  return data;
};

/** Começa a ler os acessos ao abrir o menu (a janela abre já com eles). */
export const prefetchPersonAccess = (qc: QueryClient, userId: string) =>
  void qc.prefetchQuery({
    queryKey: accessKey(userId),
    queryFn: () => fetchAccess(userId),
    staleTime: 30_000,
  });
