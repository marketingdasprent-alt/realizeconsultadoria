import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { sanitizeFileName } from '@/lib/utils';

export type EmployeeAttachment = Database['public']['Tables']['employee_attachments']['Row'];

/** Documento enviado num pedido de ausência (baixa, justificação…), com o pedido. */
export interface AbsenceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
  absence: { type: string; status: string; start_date: string; end_date: string };
}

interface AbsenceRow {
  absence_type: string;
  status: string;
  start_date: string;
  end_date: string;
  absence_documents: Omit<AbsenceFile, 'absence'>[] | null;
}

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

  /** Documentos enviados pelo colaborador nos pedidos de ausência, do mais recente. */
  listAbsenceFiles: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('absences')
      .select(
        'absence_type, status, start_date, end_date, absence_documents(id, file_name, file_path, file_size, created_at)'
      )
      .eq('employee_id', employeeId);
    const files: AbsenceFile[] = ((data ?? []) as unknown as AbsenceRow[]).flatMap(row =>
      (row.absence_documents ?? []).map(doc => ({
        ...doc,
        absence: {
          type: row.absence_type,
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
        },
      }))
    );
    return { data: files.sort((a, b) => b.created_at.localeCompare(a.created_at)), error };
  },

  /** Ligação temporária (1 min) para abrir o ficheiro, procurando também nos buckets antigos. */
  signedUrl: async (
    attachment: Pick<EmployeeAttachment, 'file_path'>,
    first = BUCKET
  ): Promise<string | null> => {
    const path = cleanPath(attachment.file_path);
    for (const bucket of [first, ...[BUCKET, ...LEGACY_BUCKETS].filter(b => b !== first)]) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  },
};
