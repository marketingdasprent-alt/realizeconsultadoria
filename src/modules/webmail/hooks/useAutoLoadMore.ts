import { useEffect, useRef, useState } from 'react';

interface AutoLoadOptions {
  hasMore: boolean;
  isLoadingMore: boolean;
  /** A última página pedida falhou: não insiste sozinho (a pessoa tenta de novo). */
  failed: boolean;
  loadMore: () => void;
  /** Páginas já carregadas: cada uma que chega volta a verificar se o fim ainda está à vista. */
  pageCount: number;
  /** Páginas seguidas que se carregam sozinhas sem a pessoa rolar. */
  maxRun: number;
  /** Mudou a caixa, a pasta, a pesquisa ou o filtro: recomeça a contagem. */
  resetKey: string;
}

/**
 * Carrega a página seguinte quando o fim da lista aparece (ou fica perto) ao rolar. Uma página
 * de cada vez: só volta a verificar quando a anterior chega. Com a lista curta (o fim já está
 * à vista) vai carregando até haver rolagem, mas no máximo `maxRun` páginas seguidas sem a
 * pessoa rolar: cada página de uma caixa de fora é uma ida ao servidor de email. Passado esse
 * limite (`stalled`), ou sem IntersectionObserver, fica o botão. Rolar de novo retoma.
 */
export const useAutoLoadMore = (options: AutoLoadOptions) => {
  const { hasMore, isLoadingMore, failed, pageCount, resetKey } = options;
  const sentinel = useRef<HTMLLIElement>(null);
  const run = useRef(0);
  const latest = useRef(options);
  latest.current = options;
  const [stalled, setStalled] = useState(false);
  const supported = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    run.current = 0;
    setStalled(false);
  }, [resetKey]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !supported || !hasMore || isLoadingMore || failed) return;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) {
          // O fim saiu de vista (a lista cresceu ou a pessoa rolou): recomeça
          run.current = 0;
          setStalled(false);
          return;
        }
        if (run.current >= latest.current.maxRun) return setStalled(true);
        run.current += 1;
        latest.current.loadMore();
      },
      { root: node.closest('ul'), rootMargin: '0px 0px 400px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, failed, pageCount, supported]);

  return { sentinel, stalled, supported };
};
