import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { mailService } from '../services/mailService';
import type { MailAccount, MailCustomFolder } from '../types';

/**
 * Pastas criadas pela pessoa em cada caixa (Outlook, Gmail, servidor IMAP), para a barra
 * lateral. Mudam pouco: pedem-se ao abrir o Webmail e de 5 em 5 minutos. Uma caixa que falhe
 * fica só sem pastas (não estraga as outras).
 */
export const useMailFolders = (accounts: MailAccount[]) => {
  const { isPreview } = useWorkspace();
  const usable = isPreview ? [] : accounts.filter(a => a.status !== 'reauth');

  const results = useQueries({
    queries: usable.map(account => ({
      queryKey: ['mail', 'folders', account.id],
      queryFn: async () => {
        const { data, error } = await mailService.folders(account.id);
        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60_000,
      refetchInterval: 5 * 60_000,
      retry: 1,
    })),
  });

  const dataKey = results.map(r => r.dataUpdatedAt).join(',');
  const byAccount = useMemo(() => {
    const map: Record<string, MailCustomFolder[]> = {};
    usable.forEach((account, index) => {
      const folders = results[index]?.data;
      if (folders?.length) map[account.id] = folders;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey resume os resultados
  }, [dataKey, usable.map(a => a.id).join(',')]);

  return { byAccount, isLoading: results.some(r => r.isLoading) };
};
