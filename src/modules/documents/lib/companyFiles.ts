import {
  baseName,
  documentTypeFor,
  extensionOf,
} from '../../../../supabase/functions/_shared/company-files';
import type { CompanyEntry, CompanyFolder } from '../services/companyFilesService';

export interface Crumb {
  label: string;
  /** null = lista das pastas atribuídas. */
  path: string | null;
}

/**
 * Migalhas de uma pasta: "Documentos" → pasta atribuída (com o nome dela) → subpastas. O que
 * está acima da pasta atribuída (ex.: "DASPRENT") não aparece.
 */
export const breadcrumbsFor = (
  path: string | null,
  folders: Pick<CompanyFolder, 'path' | 'name'>[]
): Crumb[] => {
  const crumbs: Crumb[] = [{ label: 'Documentos', path: null }];
  if (!path) return crumbs;
  const root = folders
    .filter(folder => path === folder.path || path.startsWith(`${folder.path}/`))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (!root) return [...crumbs, { label: baseName(path), path }];

  crumbs.push({ label: root.name, path: root.path });
  let current = root.path;
  for (const segment of path
    .slice(root.path.length + 1)
    .split('/')
    .filter(Boolean)) {
    current = `${current}/${segment}`;
    crumbs.push({ label: segment, path: current });
  }
  return crumbs;
};

/** Pastas primeiro, depois por nome (com números por ordem natural). */
export const sortEntries = <T extends Pick<CompanyEntry, 'name' | 'type'>>(entries: T[]): T[] =>
  [...entries].sort((a, b) =>
    a.type !== b.type
      ? a.type === 'dir'
        ? -1
        : 1
      : a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' })
  );

export type FileKind = 'folder' | 'word' | 'cell' | 'slide' | 'pdf' | 'image' | 'other';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff'];

export const fileKind = (entry: Pick<CompanyEntry, 'name' | 'type'>): FileKind => {
  if (entry.type === 'dir') return 'folder';
  const extension = extensionOf(entry.name);
  return documentTypeFor(extension) ?? (IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'other');
};

/** Abre no editor ONLYOFFICE (os outros ficheiros descarregam-se). */
export const opensInEditor = (entry: Pick<CompanyEntry, 'name' | 'type'>): boolean =>
  entry.type === 'file' && documentTypeFor(extensionOf(entry.name)) !== null;
