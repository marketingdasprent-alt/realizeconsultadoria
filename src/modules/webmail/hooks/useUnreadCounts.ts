import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useDemoMail } from '../lib/demoStore';
import { mailService } from '../services/mailService';
import type { MailAccount } from '../types';

export const MAIL_UNREAD_KEY = ['mail', 'unread'] as const;

type UnreadCounts = Record<string, number>;

/** Acerta já o número de uma caixa (ler, não lido, lixo), antes da resposta do fornecedor. */
export const bumpUnread = (qc: QueryClient, accountId: string, delta: number) => {
  if (!delta) return;
  qc.setQueryData<UnreadCounts>(MAIL_UNREAD_KEY, counts =>
    counts && accountId in counts
      ? { ...counts, [accountId]: Math.max(0, counts[accountId] + delta) }
      : counts
  );
};

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Volta a pedir os números pouco depois de uma alteração: várias seguidas (ações em grupo)
 * dão um só pedido, e o fornecedor tem tempo de atualizar a contagem.
 */
export const refreshUnreadSoon = (qc: QueryClient, delayMs = 3000) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void qc.invalidateQueries({ queryKey: MAIL_UNREAD_KEY });
  }, delayMs);
};

/**
 * Emails por ler na Entrada de cada caixa (barra lateral) e o total. Atualiza de 20 em 20 s
 * com a página à vista: um pedido leve por caixa, feito no servidor com poucos em simultâneo.
 * É o que avisa que chegou email novo (a lista atualiza-se logo que o total sobe).
 */
/** `refetchMs`: no Webmail 20 s; no menu (resto da app) mais espaçado. */
export const useUnreadCounts = (accounts: MailAccount[], refetchMs = 20_000) => {
  const { isPreview } = useWorkspace();
  const demo = useDemoMail();
  const query = useQuery({
    queryKey: MAIL_UNREAD_KEY,
    queryFn: async (): Promise<UnreadCounts> => {
      const { data, error } = await mailService.unreadCounts();
      if (error) throw error;
      return data?.counts ?? {};
    },
    enabled: !isPreview && accounts.length > 0,
    refetchInterval: refetchMs,
    staleTime: 10_000,
  });

  const demoCounts = useMemo(() => {
    const counts: UnreadCounts = {};
    for (const mail of demo.mails) {
      if (mail.folder === 'inbox' && mail.unread)
        counts[mail.accountId] = (counts[mail.accountId] ?? 0) + 1;
    }
    return counts;
  }, [demo.mails]);

  const counts = isPreview ? demoCounts : (query.data ?? {});
  const total = accounts.reduce((sum, account) => sum + (counts[account.id] ?? 0), 0);
  return { counts, total };
};
