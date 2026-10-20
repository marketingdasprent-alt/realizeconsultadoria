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

export type NewDocumentKind = 'docx' | 'xlsx' | 'pptx';

/** Documentos em branco que se podem criar numa pasta (abrem logo no editor). */
export const NEW_DOCUMENT_KINDS: { kind: NewDocumentKind; label: string; fileKind: FileKind }[] = [
  { kind: 'docx', label: 'Documento', fileKind: 'word' },
  { kind: 'xlsx', label: 'Folha de cálculo', fileKind: 'cell' },
  { kind: 'pptx', label: 'Apresentação', fileKind: 'slide' },
];

export type PreviewKind = 'image' | 'video' | 'audio';

/** Ficheiros que se veem no próprio Realize (os browsers mostram-nos sem nada instalado). */
const PREVIEW_EXTENSIONS: Record<PreviewKind, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'aac'],
};

/** Imagem, vídeo ou áudio que abre na visualização (null = descarrega). */
export const previewKind = (entry: Pick<CompanyEntry, 'name' | 'type'>): PreviewKind | null => {
  if (entry.type !== 'file') return null;
  const extension = extensionOf(entry.name);
  return (
    (Object.keys(PREVIEW_EXTENSIONS) as PreviewKind[]).find(kind =>
      PREVIEW_EXTENSIONS[kind].includes(extension)
    ) ?? null
  );
};

/** Ficheiros com miniatura na grelha (documentos, PDF e imagens). */
export const hasThumbnail = (entry: Pick<CompanyEntry, 'name' | 'type'>): boolean =>
  entry.type === 'file' && (opensInEditor(entry) || previewKind(entry) === 'image');
