import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { matchesTerm } from '@/modules/workspace/search/searchRules';
import { useDemoMail } from '../lib/demoStore';
import { readListCache, writeListCache } from '../lib/mailCache';
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
  const { isPreview, user } = useWorkspace();
  const demo = useDemoMail();
  const ids = (scope === 'all' ? accounts : accounts.filter(a => a.id === scope))
    .filter(a => a.status !== 'reauth')
    .map(a => a.id);

  // Última lista desta caixa/pasta guardada no browser: aparece já, e a nova chega a seguir.
  const cacheKey = search.trim() ? null : [scope, folder, ids.join(',')].join('|');
  const cached = useMemo(
    () => (cacheKey && !isPreview ? readListCache<MailboxPage>(user.userId, cacheKey) : null),
    [cacheKey, isPreview, user.userId]
  );

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
    initialData: cached ? { pages: [cached.page], pageParams: [null] } : undefined,
    initialDataUpdatedAt: cached?.savedAt,
  });

  const firstPage = query.data?.pages[0];
  useEffect(() => {
    if (!cacheKey || isPreview || !firstPage || query.dataUpdatedAt <= (cached?.savedAt ?? 0))
      return;
    writeListCache(user.userId, cacheKey, firstPage);
  }, [cacheKey, isPreview, firstPage, query.dataUpdatedAt, cached, user.userId]);

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

const messageKey = (mail: Pick<MailSummary, 'accountId' | 'id'> | null) =>
  ['mail', 'message', mail?.accountId, mail?.id] as const;

const fetchMessage = async (mail: MailSummary) => {
  const { data, error } = await mailService.get(mail.accountId, mail.id);
  if (error) throw error;
  return data;
};

/**
 * Pré-carrega um email quando o rato pára em cima dele (250 ms), para abrir sem espera.
 * Um de cada vez, para não atrasar o email que se abrir a seguir.
 */
export const usePrefetchMessage = () => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  return useCallback(
    (mail: MailSummary | null) => {
      if (timer.current) clearTimeout(timer.current);
      if (!mail || isPreview) return;
      timer.current = setTimeout(() => {
        if (busy.current || qc.getQueryData(messageKey(mail))) return;
        busy.current = true;
        void qc
          .prefetchQuery({
            queryKey: messageKey(mail),
            queryFn: () => fetchMessage(mail),
            staleTime: 5 * 60_000,
          })
          .finally(() => {
            busy.current = false;
          });
      }, 250);
    },
    [isPreview, qc]
  );
};

/** Email completo (corpo e anexos). */
export const useMailMessage = (summary: MailSummary | null) => {
  const { isPreview } = useWorkspace();
  const demo = useDemoMail();
  const query = useQuery({
    queryKey: messageKey(summary),
    queryFn: () => fetchMessage(summary!),
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

/**
 * Pré-carrega, em segundo plano e um de cada vez, os primeiros emails da lista: são os que
 * quase sempre se abrem, e assim abrem sem espera (também no telemóvel, onde não há rato).
 */
export const usePrefetchTop = (messages: MailSummary[], count = 4) => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const top = messages.slice(0, count);
  const signature = top.map(m => `${m.accountId}:${m.id}`).join('|');

  useEffect(() => {
    if (isPreview || !top.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const mail of top) {
        if (cancelled) return;
        if (qc.getQueryData(messageKey(mail))) continue;
        await qc
          .prefetchQuery({
            queryKey: messageKey(mail),
            queryFn: () => fetchMessage(mail),
            staleTime: 5 * 60_000,
          })
          .catch(() => undefined);
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a assinatura resume a lista
  }, [signature, isPreview, qc]);
};
