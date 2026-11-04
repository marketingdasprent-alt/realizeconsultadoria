// Páginas que existem para o colaborador e para o admin, juntas numa só entrada do menu: o
// colaborador vê a dele; o admin vê também separadores para as partes de gestão (outras rotas).
import { ROUTES } from '@/lib/constants';
import type { ModuleKey } from './navigation';

export interface SectionTab {
  label: string;
  path: string;
  /** Permissão de admin que mostra o separador (sem ela: separador de toda a gente). */
  adminModule?: string;
}

export interface Section {
  module: ModuleKey;
  tabs: SectionTab[];
}

export const SECTIONS: Section[] = [
  {
    module: 'absences',
    tabs: [
      { label: 'Os meus pedidos', path: ROUTES.EMPLOYEE.REQUESTS },
      { label: 'Gestão da equipa', path: ROUTES.ADMIN.CALENDAR, adminModule: 'calendar' },
    ],
  },
  {
    module: 'people',
    tabs: [
      { label: 'Diretório', path: '/colaborador/pessoas' },
      { label: 'Fichas e documentos', path: ROUTES.ADMIN.EMPLOYEES, adminModule: 'employees' },
    ],
  },
  {
    module: 'tickets',
    tabs: [
      { label: 'Os meus tickets', path: '/colaborador/tickets' },
      { label: 'Todos os tickets', path: ROUTES.ADMIN.SUPPORT, adminModule: 'support' },
    ],
  },
  {
    module: 'settings',
    tabs: [
      { label: 'A minha conta', path: '/colaborador/definicoes' },
      { label: 'Configurações da empresa', path: ROUTES.ADMIN.SETTINGS, adminModule: 'settings' },
    ],
  },
];

/** Páginas do admin que já estão dentro de uma entrada do Workspace (não se repetem na Gestão). */
export const MERGED_ADMIN_PATHS = new Set<string>([
  ROUTES.ADMIN.TIMECLOCK,
  ...SECTIONS.flatMap(section => section.tabs.filter(tab => tab.adminModule).map(tab => tab.path)),
]);

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** A secção (e o separador) da página aberta, se for uma das juntas. */
export const sectionFor = (pathname: string): { section: Section; tab: SectionTab } | null => {
  for (const section of SECTIONS) {
    // O separador de caminho mais comprido ganha (ex.: /colaborador/definicoes/documentos)
    const tab = [...section.tabs]
      .sort((a, b) => b.path.length - a.path.length)
      .find(item => under(pathname, item.path));
    if (tab) return { section, tab };
  }
  return null;
};
