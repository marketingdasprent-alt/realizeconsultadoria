import { supabase } from '@/integrations/supabase/client';
import type { NewDocumentKind } from '../lib/companyFiles';
import type {
  EditorMode,
  FolderPermission,
} from '../../../../supabase/functions/_shared/company-files';

/** Pasta do servidor atribuída ao colaborador. */
export interface CompanyFolder {
  path: string;
  name: string;
  permission: FolderPermission;
}

/** Ficheiro ou pasta, com o caminho relativo a D:\Shares. */
export interface CompanyEntry {
  name: string;
  type: 'dir' | 'file';
  path: string;
  size?: number;
  modified?: string;
}

export interface CompanyListing {
  /** null = lista das pastas atribuídas. */
  path: string | null;
  permission: FolderPermission | null;
  entries: CompanyEntry[];
  truncated: boolean;
}

export interface EditorSession {
  apiUrl: string;
  mode: EditorMode;
  config: Record<string, unknown>;
}

interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

const UNAVAILABLE = 'O servidor de ficheiros não respondeu. Tente outra vez.';

const UPLOAD_ERRORS: Record<number, string> = {
  401: 'O link de envio expirou. Tente outra vez.',
  403: 'O servidor de ficheiros recusou o envio.',
  404: 'A pasta já não existe.',
  409: 'Já existe um ficheiro com esse nome.',
  413: 'O ficheiro é demasiado grande.',
};

/** Envia o ficheiro direto ao agente (PUT), com o progresso de 0 a 1. */
const putFile = (url: string, file: File, onProgress: (ratio: number) => void) =>
  new Promise<string | null>(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      resolve(
        xhr.status >= 200 && xhr.status < 300
          ? null
          : (UPLOAD_ERRORS[xhr.status] ?? 'O servidor de ficheiros deu um erro.')
      );
    xhr.onerror = () => resolve(UNAVAILABLE);
    xhr.send(file);
  });

const call = async <T>(body: Record<string, unknown>): Promise<ServiceResult<T>> => {
  try {
    const { data, error } = await supabase.functions.invoke('company-files', { body });
    if (error || !data) return { data: null, error: UNAVAILABLE };
    if (!data.ok) return { data: null, error: data.message || UNAVAILABLE };
    return { data: data.data as T, error: null };
  } catch {
    return { data: null, error: UNAVAILABLE };
  }
};

/** Documentos da empresa, pela edge function `company-files` (agente de ficheiros do SRVDC). */
export const companyFilesService = {
  /** Pastas atribuídas ao colaborador. */
  folders: () => call<CompanyFolder[]>({ action: 'folders' }),

  /** Conteúdo de uma pasta. */
  list: (path: string) =>
    call<Omit<CompanyListing, 'entries'> & { entries: Omit<CompanyEntry, 'path'>[] }>({
      action: 'list',
      path,
    }),

  /** Config assinada para abrir o ficheiro no ONLYOFFICE. */
  open: (path: string) => call<EditorSession>({ action: 'open', path }),

  /** Link de descarga direta (válido 5 minutos). */
  downloadUrl: (path: string) => call<{ url: string }>({ action: 'download', path }),

  /**
   * Miniaturas (vista em grelha): 1.ª página dos documentos e PDF, ou a própria imagem.
   * Links que valem 6 horas; null = sem miniatura (fica o ícone).
   */
  thumbs: (items: Pick<CompanyEntry, 'path' | 'modified' | 'size'>[]) =>
    call<Record<string, string | null>>({ action: 'thumbs', items }),

  /** Cria uma pasta (a pasta-mãe tem de existir e ter permissão de edição). */
  createFolder: (path: string) =>
    call<{ path: string; created: boolean }>({ action: 'mkdir', path }),

  /** Documento em branco (Word, Excel ou PowerPoint) na pasta; devolve o caminho. */
  createDocument: (folder: string, name: string, kind: NewDocumentKind) =>
    call<{ path: string; name: string }>({ action: 'create', path: folder, name, kind }),

  /**
   * Carrega um ficheiro na pasta. Se o nome já existir fica "Nome (2).ext"; devolve o nome
   * com que ficou.
   */
  upload: async (
    folder: string,
    file: File,
    onProgress: (ratio: number) => void
  ): Promise<ServiceResult<{ path: string; name: string }>> => {
    const target = await call<{ path: string; name: string; url: string }>({
      action: 'upload',
      path: folder,
      name: file.name,
      size: String(file.size),
    });
    if (target.error || !target.data) return { data: null, error: target.error };
    const error = await putFile(target.data.url, file, onProgress);
    return error
      ? { data: null, error }
      : { data: { path: target.data.path, name: target.data.name }, error: null };
  },
};
