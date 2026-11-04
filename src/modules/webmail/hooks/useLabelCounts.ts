import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mailService } from '../services/mailService';
import type { MailAccount } from '../types';

export const labelCountsKey = (accountId: string) => ['mail', 'label-counts', accountId] as const;

/** Quantos emails tem cada marcador (id do marcador → número), de todas as caixas à vista. */
export const useLabelCounts = (accounts: MailAccount[]): Record<string, number> => {
  const { isPreview } = useWorkspace();
  const usable = isPreview ? [] : accounts.filter(account => account.status !== 'reauth');
  const results = useQueries({
    queries: usable.map(account => ({
      queryKey: labelCountsKey(account.id),
      queryFn: async () => {
        const { data, error } = await mailService.labelCounts(account.id);
        if (error) throw error;
        return data ?? {};
      },
      staleTime: 60_000,
      retry: 1,
    })),
  });
  const dataKey = results.map(result => result.dataUpdatedAt).join(',');
  return useMemo(
    () => Object.assign({}, ...results.map(result => result.data ?? {})) as Record<string, number>,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey resume os resultados
    [dataKey]
  );
};
