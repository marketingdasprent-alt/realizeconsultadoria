import { useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mailErrorText, mailService } from '../services/mailService';
import type { MailAccount, MailLabel } from '../types';

export const labelsKey = (accountId: string | null) => ['mail', 'labels', accountId] as const;

const fetchLabels = async (accountId: string) => {
  const { data, error } = await mailService.labels(accountId);
  if (error) throw error;
  return data;
};

/** Marcadores de uma caixa. */
export const useAccountLabels = (accountId: string | null) => {
  const { isPreview } = useWorkspace();
  return useQuery({
    queryKey: labelsKey(accountId),
    enabled: !!accountId && !isPreview,
    queryFn: () => fetchLabels(accountId ?? ''),
    staleTime: 2 * 60_000,
    retry: 1,
  });
};

/** Marcadores de todas as caixas (para as listas, a barra lateral e os menus). */
export const useAllMailLabels = (accounts: MailAccount[]) => {
  const { isPreview } = useWorkspace();
  const usable = isPreview ? [] : accounts.filter(a => a.status !== 'reauth');
  const results = useQueries({
    queries: usable.map(account => ({
      queryKey: labelsKey(account.id),
      queryFn: () => fetchLabels(account.id),
      staleTime: 2 * 60_000,
      retry: 1,
    })),
  });
  const dataKey = results.map(r => r.dataUpdatedAt).join(',');
  return useMemo(() => {
    const byAccount: Record<string, MailLabel[]> = {};
    const byId = new Map<string, MailLabel>();
    usable.forEach((account, index) => {
      const labels = results[index]?.data ?? [];
      byAccount[account.id] = labels;
      labels.forEach(label => byId.set(label.id, label));
    });
    return { byAccount, byId };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey resume os resultados
  }, [dataKey, usable.map(a => a.id).join(',')]);
};

/** Criar, alterar e apagar marcadores de uma caixa. */
export const useLabelEditor = (accountId: string | null) => {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: labelsKey(accountId) });
    // As listas mostram os marcadores: voltam a pedir-se
    void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
  };
  return {
    /** Devolve o id do marcador ou a mensagem de erro. */
    save: async (
      label: Parameters<typeof mailService.saveLabel>[1]
    ): Promise<{ id: string | null; error: string | null }> => {
      const { data, error } = await mailService.saveLabel(accountId ?? '', label);
      if (error || !data)
        return { id: null, error: mailErrorText(error) || 'Não foi possível guardar.' };
      await refresh();
      return { id: data.id, error: null };
    },
    remove: async (labelId: string): Promise<string | null> => {
      const { error } = await mailService.deleteLabel(accountId ?? '', labelId);
      if (error) return mailErrorText(error) || 'Não foi possível apagar.';
      await refresh();
      return null;
    },
  };
};
