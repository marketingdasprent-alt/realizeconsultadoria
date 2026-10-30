import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/workspaceContext';
import { closeTab, parseTabs, tabForPath, visitTab, type WorkspaceTab } from '../lib/tabs';

const storageKey = (userId: string) => `rz-tabs:${userId || 'preview'}`;

/**
 * Abas (como no Chrome): navegar para um módulo (ou abrir um ficheiro dos Documentos) abre ou
 * atualiza a sua aba; as abas ficam guardadas neste dispositivo. Atalhos: Alt+1…9 muda de
 * aba, Alt+W (ou Ctrl+W na app instalada) fecha a atual. Um só estado para a barra e para os ficheiros abertos
 * (WorkspaceTabsProvider).
 */
export const useWorkspaceTabsState = () => {
  const { basePath, user } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    try {
      return parseTabs(localStorage.getItem(storageKey(user.userId)));
    } catch {
      return [];
    }
  });
  const active = tabForPath(location.pathname, basePath, location.search)?.key ?? null;

  // A página atual entra (ou atualiza) a sua aba.
  useEffect(() => {
    if (!active) return;
    setTabs(list => visitTab(list, active, location.pathname + location.search));
  }, [active, location.pathname, location.search]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.userId), JSON.stringify(tabs));
    } catch {
      // sem armazenamento: as abas duram só esta sessão
    }
  }, [tabs, user.userId]);

  const open = useCallback((tab: WorkspaceTab) => navigate(tab.url), [navigate]);

  /** Fecha a aba; se era a atual, vai para `goTo` (ex.: a pasta do ficheiro) ou a vizinha. */
  const close = useCallback(
    (key: string, goTo?: string) => {
      const result = closeTab(tabs, key, active);
      setTabs(result.tabs);
      if (key === active) navigate(goTo ?? result.goTo ?? basePath);
    },
    [tabs, active, navigate, basePath]
  );

  /** Abre a página numa aba verdadeira do browser. */
  const openExternal = useCallback((tab: WorkspaceTab) => {
    window.open(`${window.location.origin}${tab.url}`, '_blank', 'noopener');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl+W na app instalada (janela própria): fecha a aba do Realize em vez da janela.
      // Num separador normal o browser fecha-o antes de a página receber a tecla (Alt+W serve).
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.code === 'KeyW' &&
        active &&
        tabs.length > 1 &&
        window.matchMedia?.('(display-mode: standalone)').matches
      ) {
        event.preventDefault();
        close(active);
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
      if (digit) {
        const tab = tabs[Number(digit) - 1];
        if (tab) {
          event.preventDefault();
          navigate(tab.url);
        }
      } else if (event.code === 'KeyW' && active) {
        event.preventDefault();
        close(active);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, active, navigate, close]);

  return { tabs, active, open, close, openExternal };
};

export type WorkspaceTabsValue = ReturnType<typeof useWorkspaceTabsState>;

export const WorkspaceTabsContext = createContext<WorkspaceTabsValue | null>(null);

/** Abas da área do colaborador (dentro do WorkspaceShell). */
export const useWorkspaceTabs = (): WorkspaceTabsValue => {
  const value = useContext(WorkspaceTabsContext);
  if (!value) throw new Error('useWorkspaceTabs tem de ser usado dentro do WorkspaceTabsProvider');
  return value;
};
