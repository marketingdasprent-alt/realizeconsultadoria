// Abas da área do colaborador (como no Chrome): uma aba por módulo, que se lembra da última
// página aberta nesse módulo. Funções puras (testadas em __tests__/tabs.test.ts).
import { UserRound, type LucideIcon } from 'lucide-react';
import { ALL_MODULES } from './navigation';

export interface WorkspaceTab {
  /** Módulo (ex.: 'feed', 'email') ou 'profile'. */
  key: string;
  /** Última página aberta nesta aba (caminho + pesquisa). */
  url: string;
}

export interface TabInfo {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
}

const PROFILE: TabInfo = {
  key: 'profile',
  label: 'O meu perfil',
  icon: UserRound,
  tint: 'from-violet-500 to-fuchsia-500',
};

/** Que aba corresponde a uma página (pelo primeiro segmento depois da base). */
export const tabForPath = (pathname: string, basePath: string): TabInfo | null => {
  if (!pathname.startsWith(basePath)) return null;
  const segment = pathname.slice(basePath.length).replace(/^\/+/, '').split('/')[0] ?? '';
  if (segment === 'perfil') return PROFILE;
  const module = ALL_MODULES.find(m => m.path === segment);
  return module
    ? { key: module.key, label: module.label, icon: module.icon, tint: module.tint }
    : null;
};

export const tabInfo = (key: string): TabInfo | null => {
  if (key === 'profile') return PROFILE;
  const module = ALL_MODULES.find(m => m.key === key);
  return module ? { key, label: module.label, icon: module.icon, tint: module.tint } : null;
};

/** Ao navegar: atualiza a aba do módulo ou abre uma nova no fim. */
export const visitTab = (tabs: WorkspaceTab[], key: string, url: string): WorkspaceTab[] =>
  tabs.some(t => t.key === key)
    ? tabs.map(t => (t.key === key ? { ...t, url } : t))
    : [...tabs, { key, url }];

/**
 * Fechar uma aba. Se era a ativa, devolve para onde ir: a da direita ou, sem ela, a da
 * esquerda (null se não sobrar nenhuma).
 */
export const closeTab = (
  tabs: WorkspaceTab[],
  key: string,
  activeKey: string | null
): { tabs: WorkspaceTab[]; goTo: string | null } => {
  const index = tabs.findIndex(t => t.key === key);
  if (index < 0) return { tabs, goTo: null };
  const next = tabs.filter(t => t.key !== key);
  if (key !== activeKey) return { tabs: next, goTo: null };
  const neighbour = next[index] ?? next[index - 1] ?? null;
  return { tabs: next, goTo: neighbour?.url ?? null };
};

/** Lê as abas guardadas (só as que ainda correspondem a um módulo). */
export const parseTabs = (raw: string | null): WorkspaceTab[] => {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (t): t is WorkspaceTab =>
              !!t && typeof t.key === 'string' && typeof t.url === 'string' && !!tabInfo(t.key)
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
};
