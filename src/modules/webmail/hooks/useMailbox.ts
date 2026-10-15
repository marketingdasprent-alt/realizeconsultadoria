import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { matchesTerm } from '@/modules/workspace/search/searchRules';
import { useDemoMail } from '../lib/demoStore';
import { mailService, type MailError } from '../services/mailService';
import type { MailAccount, MailFolder, MailSummary } from '../types';

/** Página da caixa unificada: os tokens de cada conta que ainda tem mais emails. */
type PageTokens = Record<string, string> | null;

interface MailboxPage {
  messages: MailSummary[];
  next: Record<string, string>;
  errors: Record<string, MailError>;
}

/**
 * Lista de emails de uma conta ou de todas ("all", caixa unificada), mais recentes
 * primeiro, com "carregar mais" por conta.
 */
export const useMailbox = (
  accounts: MailAccount[],
  scope: string,
  folder: MailFolder,
  search: string
) => {
  const { isPreview } = useWorkspace();
  const demo = useDemoMail();
  const ids = (scope === 'all' ? accounts : accounts.filter(a => a.id === scope))
    .filter(a => a.status !== 'reauth')
    .map(a => a.id);

  const query = useInfiniteQuery({
    queryKey: ['mail', 'list', scope, folder, search.trim(), ids.join(',')],
    initialPageParam: null as PageTokens,
    queryFn: async ({ pageParam }): Promise<MailboxPage> => {
      const targets = pageParam ? Object.keys(pageParam) : ids;
      const results = await Promise.all(
        targets.map(id => mailService.list(id, folder, search.trim(), pageParam?.[id] ?? null))
      );
      const page: MailboxPage = { messages: [], next: {}, errors: {} };
      results.forEach((result, index) => {
        const id = targets[index];
        if (result.error) page.errors[id] = result.error;
        if (!result.data) return;
        page.messages.push(...result.data.messages);
        if (result.data.nextPageToken) page.next[id] = result.data.nextPageToken;
      });
      return page;
    },
    getNextPageParam: last => (Object.keys(last.next).length ? last.next : undefined),
    enabled: !isPreview && ids.length > 0,
    staleTime: 30_000,
  });

  const live = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? [])
      .flatMap(page => page.messages)
      .filter(m => !seen.has(`${m.accountId}:${m.id}`) && seen.add(`${m.accountId}:${m.id}`))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [query.data]);

  const demoList = useMemo(
    () =>
      demo.mails
        .filter(m => ids.includes(m.accountId))
        .filter(m =>
          folder === 'starred' ? m.starred && m.folder !== 'trash' : m.folder === folder
        )
        .filter(m => matchesTerm(search, m.subject, m.snippet, m.from?.name, m.from?.email))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids é derivado de accounts/scope
    [demo.mails, accounts, scope, folder, search]
  );

  const errors = Object.assign({}, ...(query.data?.pages ?? []).map(p => p.errors)) as Record<
    string,
    MailError
  >;
  return {
    messages: isPreview ? demoList : live,
    isLoading: !isPreview && query.isLoading && ids.length > 0,
    isRefreshing: !isPreview && query.isRefetching,
    hasMore: !isPreview && !!query.hasNextPage,
    loadMore: () => query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
    errors,
    refetch: () => query.refetch(),
  };
};

/** Email completo (corpo e anexos). */
export const useMailMessage = (summary: MailSummary | null) => {
  const { isPreview } = useWorkspace();
  const demo = useDemoMail();
  const query = useQuery({
    queryKey: ['mail', 'message', summary?.accountId, summary?.id],
    queryFn: async () => {
      const { data, error } = await mailService.get(summary!.accountId, summary!.id);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview && !!summary,
    staleTime: 5 * 60_000,
  });
  if (isPreview)
    return {
      message: summary ? (demo.mails.find(m => m.id === summary.id) ?? null) : null,
      isLoading: false,
      isError: false,
    };
  return { message: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
};
