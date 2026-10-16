import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { sanitizeFileName } from '@/lib/utils';

export type EmployeeAttachment = Database['public']['Tables']['employee_attachments']['Row'];

const BUCKET = 'employee-files';
// Ficheiros antigos podem ter ficado noutros buckets (antes de tudo ir para employee-files).
const LEGACY_BUCKETS = ['absence-documents', 'documents', 'employees'];

const cleanPath = (path: string) => (path.startsWith('/') ? path.slice(1) : path);

/**
 * Anexos do colaborador (BackOffice): documentos dos pedidos de ausência e baixas (copiados ao
 * aprovar) e outros ficheiros carregados pelo admin. O colaborador não os vê.
 */
export const attachmentService = {
  list: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('employee_attachments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    return { data: data ?? [], error };
  },

  upload: async (employeeId: string, file: File, description: string | null) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sessão terminada. Entre de novo.');
      const path = `${employeeId}/attachments/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from('employee_attachments').insert({
        employee_id: employeeId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        source: 'admin',
        description,
        uploaded_by: auth.user.id,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  remove: async (attachment: EmployeeAttachment) => {
    try {
      await supabase.storage.from(BUCKET).remove([cleanPath(attachment.file_path)]);
      const { error } = await supabase
        .from('employee_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  /** Ligação temporária (1 min) para abrir o ficheiro, procurando também nos buckets antigos. */
  signedUrl: async (attachment: EmployeeAttachment): Promise<string | null> => {
    const path = cleanPath(attachment.file_path);
    for (const bucket of [BUCKET, ...LEGACY_BUCKETS]) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  },
};
