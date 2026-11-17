import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { matchesTerm } from '@/modules/workspace/search/searchRules';
import { useDemoMail } from '../lib/demoStore';
import { NO_FILTER, filterKey, serverFilters, type ListFilter } from '../lib/listFilter';
import { readMailboxCache, writeMailboxCache } from '../lib/mailCache';
import { mailService, type MailError } from '../services/mailService';
import type { MailAccount, MailFolder, MailSummary } from '../types';

/** Página da caixa unificada: os tokens de cada conta que ainda tem mais emails. */
type PageTokens = Record<string, string> | null;

/** Pesquisa em todas as pastas: o que o servidor disse sobre ela. */
export interface AllFoldersInfo {
  /** O servidor conhece este modo (um servidor antigo devolve só a pasta aberta). */
  supported: boolean;
  /** Havia mais resultados do que os mostrados. */
  truncated: boolean;
  /** Acabou o tempo e ficaram pastas por pesquisar. */
  partial: boolean;
}

/** O que se pede na pesquisa em todas as pastas (`body`: também no texto dos emails). */
export interface AllFoldersSearch {
  body: boolean;
}

interface MailboxPage {
  messages: MailSummary[];
  next: Record<string, string>;
  errors: Record<string, MailError>;
  /** Só na pesquisa em todas as pastas (a cache do navegador não a guarda). */
  allFolders?: AllFoldersInfo | null;
}

/**
 * Lista de emails de uma conta ou de todas ("all", caixa unificada), mais recentes
 * primeiro, com "carregar mais" por conta.
 */
export const useMailbox = (
  accounts: MailAccount[],
  scope: string,
  folder: MailFolder,
  search: string,
  /** Pasta criada pela pessoa (manda sobre `folder`; só a caixa dessa pasta). */
  folderId: string | null = null,
  /** Só emails com este marcador (o servidor filtra; só da caixa do marcador). */
  labelFilter: { accountId: string; labelId: string } | null = null,
  /** Filtros da lista: vão ao servidor (Gmail e Microsoft 365 filtram lá); o ecrã filtra sempre. */
  filter: ListFilter = NO_FILTER,
  /** Pesquisa em todas as pastas das caixas (ignora a pasta aberta; sem páginas seguintes). */
  allFolders: AllFoldersSearch | null = null
) => {
  const { isPreview, user } = useWorkspace();
  const demo = useDemoMail();
  const ids = (scope === 'all' ? accounts : accounts.filter(a => a.id === scope))
    .filter(a => !labelFilter || a.id === labelFilter.accountId)
    .filter(a => a.status !== 'reauth')
    .map(a => a.id);

  // A ordem das caixas não muda a lista (nem a chave da cache).
  const idsKey = [...ids].sort().join(',');
  // Na cache do browser, cada pasta da pessoa tem a sua lista.
  const cacheFolder = folderId ? `custom:${folderId}` : folder;
  // Última lista de cada caixa guardada no browser: aparece já, e a nova chega a seguir.
  const filtersKey = filterKey(filter);
  // Com filtros a lista guardada no browser não serve (é a da pasta inteira)
  const useCache = !search.trim() && !isPreview && !labelFilter && !filtersKey && !allFolders;
  const cached = useMemo(
    () =>
      useCache
        ? readMailboxCache<MailSummary>(user.userId, idsKey.split(',').filter(Boolean), cacheFolder)
        : null,
    [useCache, user.userId, idsKey, cacheFolder]
  );

  // Atualizar (botão, ou chegou email novo): o servidor não pode responder com a lista guardada
  const freshRef = useRef(false);
  const query = useInfiniteQuery({
    queryKey: [
      'mail',
      'list',
      scope,
      cacheFolder,
      search.trim(),
      idsKey,
      labelFilter?.labelId ?? '',
      // Listas filtradas e não filtradas nunca se misturam na cache
      filtersKey,
      // Pesquisa em todas as pastas: outra lista (com ou sem o texto dos emails)
      allFolders ? (allFolders.body ? 'all-folders+body' : 'all-folders') : '',
    ],
    initialPageParam: null as PageTokens,
    queryFn: async ({ pageParam }): Promise<MailboxPage> => {
      const targets = pageParam ? Object.keys(pageParam) : ids;
      const fresh = freshRef.current && !pageParam;
      if (!pageParam) freshRef.current = false;
      const results = await Promise.all(
        targets.map(id =>
          mailService.list(
            id,
            folder,
            search.trim(),
            pageParam?.[id] ?? null,
            folderId,
            labelFilter?.labelId,
            fresh,
            serverFilters(filter),
            allFolders
          )
        )
      );
      const page: MailboxPage = { messages: [], next: {}, errors: {}, allFolders: null };
      results.forEach((result, index) => {
        const id = targets[index];
        if (result.error) page.errors[id] = result.error;
        if (!result.data) return;
        const info = result.data.allFolders;
        if (info)
          page.allFolders = {
            supported: (page.allFolders?.supported ?? true) && info.supported,
            truncated: (page.allFolders?.truncated ?? false) || info.truncated,
            partial: (page.allFolders?.partial ?? false) || info.partial,
          };
        page.messages.push(...result.data.messages);
        if (result.data.nextPageToken) page.next[id] = result.data.nextPageToken;
      });
      return page;
    },
    getNextPageParam: last => (Object.keys(last.next).length ? last.next : undefined),
    enabled: !isPreview && ids.length > 0,
    staleTime: 15_000,
    // Com o Webmail aberto, a lista vai-se atualizando sozinha (um email lido noutro sítio,
    // ex. no Outlook, não gera aviso e não chegava ao ecrã) e também ao voltar à janela.
    refetchInterval: search.trim() ? false : 60_000,
    refetchOnWindowFocus: true,
    initialData: cached ? { pages: [cached.page], pageParams: [null] } : undefined,
    initialDataUpdatedAt: cached?.savedAt,
  });

  const firstPage = query.data?.pages[0];
  useEffect(() => {
    if (!useCache || !firstPage || query.dataUpdatedAt <= (cached?.savedAt ?? 0)) return;
    writeMailboxCache(user.userId, ids, cacheFolder, firstPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids resume-se em idsKey
  }, [useCache, firstPage, query.dataUpdatedAt, cached, user.userId, idsKey, cacheFolder]);

  const live = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<string>();
    const all = pages
      .flatMap(page => page.messages)
      .filter(m => !seen.has(`${m.accountId}:${m.id}`) && seen.add(`${m.accountId}:${m.id}`))
      .sort((a, b) => b.date.localeCompare(a.date));
    // Várias caixas juntas: uma caixa com mais páginas por carregar só tem os emails até ao
    // mais antigo que já veio. Os das outras caixas mais antigos do que isso esperam (senão
    // apareciam por cima de emails que ainda faltam e pareciam faltar emails).
    const pending = Object.keys(pages[pages.length - 1]?.next ?? {});
    if (pending.length < 1 || ids.length < 2) return all;
    const oldestOf = (accountId: string) => {
      const mine = all.filter(m => m.accountId === accountId);
      return mine.length ? mine[mine.length - 1].date : '';
    };
    const cutoff = pending.map(oldestOf).reduce((max, date) => (date > max ? date : max), '');
    return cutoff ? all.filter(m => m.date >= cutoff) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids resume-se em idsKey
  }, [query.data, idsKey]);

  const demoList = useMemo(
    () =>
      demo.mails
        .filter(m => ids.includes(m.accountId))
        .filter(m =>
          allFolders
            ? m.folder !== 'trash' && m.folder !== 'spam'
            : folder === 'starred'
              ? m.starred && m.folder !== 'trash'
              : folder === 'unread'
                ? m.unread && m.folder === 'inbox'
                : m.folder === folder
        )
        .filter(m => matchesTerm(search, m.subject, m.snippet, m.from?.name, m.from?.email))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids é derivado de accounts/scope
    [demo.mails, accounts, scope, folder, search, allFolders]
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
    /** A última página pedida falhou (a lista que já veio mantém-se). */
    loadMoreFailed: !isPreview && query.isFetchNextPageError,
    /** Páginas já carregadas (cada uma que chega volta a verificar se há mais para mostrar). */
    pageCount: query.data?.pages.length ?? 0,
    /** Pesquisa em todas as pastas: o que o servidor disse (null fora desse modo). */
    allFoldersInfo: allFolders ? (query.data?.pages[0]?.allFolders ?? null) : null,
    errors,
    refetch: () => {
      freshRef.current = true;
      return query.refetch();
    },
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
    // Uma repetição no máximo (o pedido já tenta duas vezes): depois mostra o erro e o
    // "Tentar outra vez", em vez de ficar minutos em "A abrir o email…".
    retry: 1,
  });
  if (isPreview)
    return {
      message: summary ? (demo.mails.find(m => m.id === summary.id) ?? null) : null,
      isLoading: false,
      isError: false,
      retry: () => undefined,
    };
  return {
    message: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    retry: () => void query.refetch(),
  };
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

/** As outras mensagens da conversa do email aberto (Gmail e Microsoft 365). */
export const useMailThread = (summary: MailSummary | null) => {
  const { isPreview } = useWorkspace();
  const query = useQuery({
    queryKey: ['mail', 'thread', summary?.accountId, summary?.threadId] as const,
    queryFn: async () => {
      const { data, error } = await mailService.thread(summary!.accountId, summary!.threadId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isPreview && !!summary?.threadId,
    staleTime: 60_000,
  });
  return query.data ?? [];
};
