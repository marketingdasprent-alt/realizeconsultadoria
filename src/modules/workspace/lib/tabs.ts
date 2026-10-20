// Abas da área do colaborador (como no Chrome): uma aba por módulo, que se lembra da última
// página aberta nesse módulo, e uma por ficheiro aberto dos Documentos (vários ao mesmo
// tempo, cada um continua carregado). Funções puras (testadas em __tests__/tabs.test.ts).
import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Presentation,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
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

const FILE_STYLES: { extensions: string[]; icon: LucideIcon; tint: string }[] = [
  {
    extensions: ['docx', 'doc', 'odt', 'rtf', 'txt'],
    icon: FileText,
    tint: 'from-sky-500 to-blue-600',
  },
  {
    extensions: ['xlsx', 'xls', 'ods', 'csv'],
    icon: FileSpreadsheet,
    tint: 'from-emerald-500 to-green-600',
  },
  { extensions: ['pptx', 'ppt', 'odp'], icon: Presentation, tint: 'from-orange-400 to-red-500' },
  { extensions: ['pdf'], icon: FileType2, tint: 'from-rose-500 to-red-600' },
  {
    extensions: [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'bmp',
      'svg',
      'avif',
      'mp4',
      'webm',
      'mov',
      'm4v',
      'mp3',
      'wav',
      'm4a',
      'ogg',
      'aac',
    ],
    icon: FileImage,
    tint: 'from-violet-500 to-fuchsia-500',
  },
];

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

const fileInfo = (key: string, fileName: string): TabInfo => {
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : '';
  const style = FILE_STYLES.find(s => s.extensions.includes(extension));
  return {
    key,
    label: fileName || 'Ficheiro',
    icon: style?.icon ?? File,
    tint: style?.tint ?? 'from-slate-400 to-slate-600',
  };
};

/**
 * Aba de um ficheiro dos Documentos (pela pesquisa do endereço): `file:<caminho>` para um
 * documento no editor e `view:<pasta>` para as imagens/vídeos de uma pasta (as setas mudam de
 * ficheiro sem abrir abas novas).
 */
export const fileTabKey = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const editing = params.get('abrir');
  if (editing) return `file:${editing}`;
  const viewing = params.get('ver');
  return viewing ? `view:${folderOf(viewing)}` : null;
};

export const isFileTab = (key: string) => key.startsWith('file:') || key.startsWith('view:');

/** Que aba corresponde a uma página (pelo primeiro segmento depois da base). */
export const tabForPath = (pathname: string, basePath: string, search = ''): TabInfo | null => {
  if (!pathname.startsWith(basePath)) return null;
  const segment = pathname.slice(basePath.length).replace(/^\/+/, '').split('/')[0] ?? '';
  if (segment === 'perfil') return PROFILE;
  const module = ALL_MODULES.find(m => m.path === segment);
  if (module?.key === 'documents') {
    const key = fileTabKey(search);
    if (key) return tabInfo(key, `${pathname}${search}`);
  }
  return module
    ? { key: module.key, label: module.label, icon: module.icon, tint: module.tint }
    : null;
};

/** Ficheiro mostrado numa aba de ficheiro (o da pesquisa `abrir` ou `ver` do endereço). */
export const fileOfTab = (url: string): { path: string; mode: 'edit' | 'view' } | null => {
  const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?')) : '');
  const editing = params.get('abrir');
  if (editing) return { path: editing, mode: 'edit' };
  const viewing = params.get('ver');
  return viewing ? { path: viewing, mode: 'view' } : null;
};

export const tabInfo = (key: string, url = ''): TabInfo | null => {
  if (key.startsWith('file:')) return fileInfo(key, nameOf(key.slice(5)));
  if (key.startsWith('view:')) {
    const file = fileOfTab(url);
    return fileInfo(key, file ? nameOf(file.path) : nameOf(key.slice(5)));
  }
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
