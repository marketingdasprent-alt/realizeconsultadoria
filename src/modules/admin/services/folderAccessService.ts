// Pastas do servidor de ficheiros (SRVDC) a que cada colaborador tem acesso nos Documentos.
// As atribuições ficam em folder_assignments (só admins as gerem, pelo RLS); o explorador das
// pastas do servidor e a criação de pastas passam pela edge function company-files.
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type FolderAssignment = Database['public']['Tables']['folder_assignments']['Row'];
export type FolderPermission = 'read' | 'edit';

/** Pasta do servidor no explorador do admin. */
export interface ServerFolder {
  name: string;
  path: string;
}

const UNAVAILABLE = 'O servidor de ficheiros não respondeu. Tente outra vez.';

const callFiles = async <T>(body: Record<string, string>) => {
  try {
    const { data, error } = await supabase.functions.invoke('company-files', { body });
    if (error || !data) return { data: null, error: UNAVAILABLE };
    if (!data.ok) return { data: null, error: (data.message as string) || UNAVAILABLE };
    return { data: data.data as T, error: null };
  } catch {
    return { data: null, error: UNAVAILABLE };
  }
};

export const folderAccessService = {
  /** Pastas atribuídas ao colaborador. */
  listForEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('folder_assignments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('path');
    return { data: data ?? [], error };
  },

  /** Dá acesso a uma pasta (e às subpastas). */
  assign: async (employeeId: string, path: string, permission: FolderPermission) => {
    const { error } = await supabase
      .from('folder_assignments')
      .upsert({ employee_id: employeeId, path, permission }, { onConflict: 'employee_id,path' });
    return { error };
  },

  setPermission: async (id: string, permission: FolderPermission) => {
    const { error } = await supabase.from('folder_assignments').update({ permission }).eq('id', id);
    return { error };
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('folder_assignments').delete().eq('id', id);
    return { error };
  },

  /** Subpastas de uma pasta do servidor (sem caminho: as raízes de D:\Shares). */
  browse: (path: string | null) =>
    callFiles<{ path: string | null; entries: ServerFolder[]; truncated?: boolean }>({
      action: 'admin-list',
      ...(path ? { path } : {}),
    }),

  /** Cria uma pasta no servidor (dentro de uma raiz). */
  createFolder: (path: string) =>
    callFiles<{ path: string; created: boolean }>({ action: 'admin-mkdir', path }),
};
