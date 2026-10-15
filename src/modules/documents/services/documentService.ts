import { supabase } from '@/integrations/supabase/client';
import { PAYSLIP_CATEGORY, type EmployeeDocument } from '@/lib/documents';
import { sanitizeFileName } from '@/lib/utils';

const BUCKET = 'employee-files';
/** Buckets antigos onde documentos legados podem ainda estar guardados. */
const LEGACY_BUCKETS = [
  'absence-documents',
  'equipment_invoices',
  'legal_documents',
  'employees',
  'documents',
];

export type EmployeeDocumentWithEmployee = EmployeeDocument & {
  employee?: {
    id: string;
    name: string;
    company_id: string;
    companies?: { name: string } | null;
  } | null;
};

export interface ReviewInput {
  decision: 'approved' | 'rejected';
  category?: string | null;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  periodMonth?: string | null;
  notes?: string | null;
}

interface UploadBase {
  employeeId: string;
  file: File;
  category: string;
  description?: string | null;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
}

const WITH_EMPLOYEE = '*, employee:employees(id, name, company_id, companies(name))';

const storagePath = (employeeId: string, folder: string, file: File) =>
  `${employeeId}/${folder}/${Date.now()}_${sanitizeFileName(file.name)}`;

const uploadFile = async (path: string, file: File) => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
};

const currentUser = async () => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Utilizador não autenticado');
  return data.user;
};

export const documentService = {
  /** Todos os documentos de um colaborador (o RLS limita ao próprio ou a admins). */
  listForEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    return { data: (data ?? []) as EmployeeDocument[], error };
  },

  /** Fila de aprovação do BackOffice. */
  listPending: async () => {
    const { data, error } = await supabase
      .from('employee_documents')
      .select(WITH_EMPLOYEE)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    return { data: (data ?? []) as EmployeeDocumentWithEmployee[], error };
  },

  /** Documentos atuais a expirar nos próximos `days` dias (ou já expirados). */
  listExpiring: async (days: number) => {
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    const { data, error } = await supabase
      .from('employee_documents')
      .select(WITH_EMPLOYEE)
      .eq('is_current', true)
      .eq('status', 'approved')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', limit.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true });
    return { data: (data ?? []) as EmployeeDocumentWithEmployee[], error };
  },

  /** Recibos atuais de um mês (yyyy-MM-01), opcionalmente só de uma empresa. */
  listPayslipsForMonth: async (periodMonth: string) => {
    const { data, error } = await supabase
      .from('employee_documents')
      .select(WITH_EMPLOYEE)
      .eq('category', PAYSLIP_CATEGORY)
      .eq('period_month', periodMonth)
      .eq('is_current', true);
    return { data: (data ?? []) as EmployeeDocumentWithEmployee[], error };
  },

  /**
   * Submissão pelo colaborador: fica pendente até o BackOffice aprovar.
   */
  submitAsEmployee: async (input: UploadBase & { employeeName: string }) => {
    try {
      const user = await currentUser();
      const path = await uploadFile(
        storagePath(input.employeeId, 'documents', input.file),
        input.file
      );
      const { error } = await supabase.from('employee_documents').insert({
        employee_id: input.employeeId,
        file_name: input.file.name,
        file_path: path,
        file_size: input.file.size,
        mime_type: input.file.type || 'application/octet-stream',
        category: input.category,
        description: input.description || null,
        document_number: input.documentNumber || null,
        issue_date: input.issueDate || null,
        expiry_date: input.expiryDate || null,
        uploaded_by: user.id,
        uploaded_by_role: 'employee',
        uploaded_by_name: input.employeeName,
      });
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  /**
   * Upload pelo BackOffice: fica aprovado e passa a ser o documento atual do tipo.
   */
  uploadAsAdmin: async (input: UploadBase) => {
    try {
      const user = await currentUser();
      const path = await uploadFile(
        storagePath(input.employeeId, 'documents', input.file),
        input.file
      );
      const { data, error } = await supabase
        .from('employee_documents')
        .insert({
          employee_id: input.employeeId,
          file_name: input.file.name,
          file_path: path,
          file_size: input.file.size,
          mime_type: input.file.type || 'application/octet-stream',
          category: input.category,
          description: input.description || null,
          uploaded_by: user.id,
          uploaded_by_role: 'admin',
          uploaded_by_name: user.email ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      const { error: reviewError } = await supabase.rpc('review_employee_document', {
        _document_id: data.id,
        _decision: 'approved',
        _category: input.category,
        _document_number: input.documentNumber ?? null,
        _issue_date: input.issueDate ?? null,
        _expiry_date: input.expiryDate ?? null,
      });
      if (reviewError) throw reviewError;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  /**
   * Importa um recibo de vencimento (substitui o recibo atual do mesmo mês).
   */
  uploadPayslip: async (input: { employeeId: string; periodMonth: string; file: File }) => {
    try {
      const user = await currentUser();
      const path = await uploadFile(
        `${input.employeeId}/payslips/${input.periodMonth.slice(0, 7)}_${sanitizeFileName(input.file.name)}`,
        input.file
      );
      const { data, error } = await supabase
        .from('employee_documents')
        .insert({
          employee_id: input.employeeId,
          file_name: input.file.name,
          file_path: path,
          file_size: input.file.size,
          mime_type: input.file.type || 'application/pdf',
          category: PAYSLIP_CATEGORY,
          period_month: input.periodMonth,
          uploaded_by: user.id,
          uploaded_by_role: 'admin',
          uploaded_by_name: user.email ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      const { error: reviewError } = await supabase.rpc('review_employee_document', {
        _document_id: data.id,
        _decision: 'approved',
        _category: PAYSLIP_CATEGORY,
        _period_month: input.periodMonth,
      });
      if (reviewError) throw reviewError;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  /** Aprovar (com metadados) ou rejeitar (com motivo). */
  review: async (documentId: string, input: ReviewInput) => {
    const { error } = await supabase.rpc('review_employee_document', {
      _document_id: documentId,
      _decision: input.decision,
      _category: input.category ?? null,
      _document_number: input.documentNumber ?? null,
      _issue_date: input.issueDate ?? null,
      _expiry_date: input.expiryDate ?? null,
      _period_month: input.periodMonth ?? null,
      _notes: input.notes ?? null,
    });
    return { success: !error, error };
  },

  /** Apaga o registo e, se mais nenhum o referenciar, o ficheiro. */
  remove: async (doc: EmployeeDocument) => {
    try {
      const { count } = await supabase
        .from('employee_documents')
        .select('id', { count: 'exact', head: true })
        .eq('file_path', doc.file_path)
        .neq('id', doc.id);
      if (!count) await supabase.storage.from(BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },

  /** URL temporário para abrir/descarregar (tenta o bucket atual e os legados). */
  getSignedUrl: async (filePath: string) => {
    const path = filePath.replace(/^\//, '');
    for (const bucket of [BUCKET, ...LEGACY_BUCKETS]) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
      if (data?.signedUrl) return { url: data.signedUrl, error: null };
    }
    return { url: null, error: new Error('Ficheiro não encontrado no armazenamento') };
  },
};
