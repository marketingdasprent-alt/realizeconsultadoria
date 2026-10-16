import { supabase } from '@/integrations/supabase/client';
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

const call = async <T>(body: Record<string, string>): Promise<ServiceResult<T>> => {
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

  /** Cria uma pasta (a pasta-mãe tem de existir e ter permissão de edição). */
  createFolder: (path: string) =>
    call<{ path: string; created: boolean }>({ action: 'mkdir', path }),
};
