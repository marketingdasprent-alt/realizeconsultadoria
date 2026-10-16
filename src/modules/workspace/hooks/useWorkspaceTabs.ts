import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/workspaceContext';
import { closeTab, parseTabs, tabForPath, visitTab, type WorkspaceTab } from '../lib/tabs';

const storageKey = (userId: string) => `rz-tabs:${userId || 'preview'}`;

/**
 * Abas (como no Chrome): navegar para um módulo abre/atualiza a sua aba; as abas ficam
 * guardadas neste dispositivo. Atalhos: Alt+1…9 muda de aba, Alt+W fecha a atual.
 */
export const useWorkspaceTabs = () => {
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
  const active = tabForPath(location.pathname, basePath)?.key ?? null;

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

  const close = useCallback(
    (key: string) => {
      const result = closeTab(tabs, key, active);
      setTabs(result.tabs);
      if (key === active) navigate(result.goTo ?? basePath);
    },
    [tabs, active, navigate, basePath]
  );

  /** Abre a página numa aba verdadeira do browser. */
  const openExternal = useCallback((tab: WorkspaceTab) => {
    window.open(`${window.location.origin}${tab.url}`, '_blank', 'noopener');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
