// Pedidos de ausência no admin: a lista (com períodos e n.º de documentos num só pedido à BD)
// e as decisões — aprovar, rejeitar e desaprovar. O saldo de férias e o aviso ao colaborador
// ficam a cargo dos triggers da BD.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { describeConflicts, findApprovedConflicts } from '@/lib/absence-overlap';
import { absenceTypeLabels } from '@/lib/absence-types';
import { countBusinessDays, type Holiday } from '@/lib/vacation-utils';
import type { AbsencePeriod, AbsenceRequest, Overlap } from '../lib/absenceRequests';

interface ServiceResult<T> {
  data: T | null;
  error: unknown;
}

type DecisionRequest = Pick<
  AbsenceRequest,
  'id' | 'employee_id' | 'start_date' | 'end_date' | 'absence_type'
>;

export interface RequestsData {
  requests: AbsenceRequest[];
  holidays: Holiday[];
}

export interface VacationBalance {
  total: number;
  used: number;
}

const REQUEST_COLUMNS = `id, status, absence_type, training_mode, notes, rejection_reason, created_at,
  start_date, end_date, employee_id, approved_by,
  employees!inner(id, name, email, user_id, position, department, companies!inner(id, name)),
  absence_periods(id, start_date, end_date, business_days, status, period_type, start_time, end_time),
  absence_documents(count)`;

interface RequestRow {
  id: string;
  status: string;
  absence_type: string;
  training_mode: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  start_date: string;
  end_date: string;
  employee_id: string;
  approved_by: string | null;
  employees: {
    id: string;
    name: string;
    email: string;
    user_id: string | null;
    position: string | null;
    department: string | null;
    companies: { id: string; name: string };
  };
  absence_periods: AbsencePeriod[];
  absence_documents: { count: number }[];
}

const sessionUserId = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Não autenticado');
  return data.session.user.id;
};

const toRequest = (
  row: RequestRow,
  holidays: Holiday[],
  approvers: Map<string, string>
): AbsenceRequest => {
  const periods = [...row.absence_periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  return {
    id: row.id,
    status: row.status,
    absence_type: row.absence_type,
    training_mode: row.training_mode,
    notes: row.notes,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    start_date: row.start_date,
    end_date: row.end_date,
    employee_id: row.employee_id,
    total_business_days:
      periods.length > 0
        ? periods.reduce((sum, period) => sum + Number(period.business_days), 0)
        : countBusinessDays(parseISO(row.start_date), parseISO(row.end_date), holidays),
    document_count: row.absence_documents[0]?.count ?? 0,
    approved_by: row.approved_by,
    approver_name: row.approved_by ? (approvers.get(row.approved_by) ?? null) : null,
    employee: {
      id: row.employees.id,
      name: row.employees.name,
      email: row.employees.email,
      user_id: row.employees.user_id,
      position: row.employees.position,
      department: row.employees.department,
    },
    company: row.employees.companies,
    periods,
  };
};

/**
 * Copia os documentos do pedido (ex.: atestado) para os anexos do colaborador. Falhas num
 * ficheiro não travam a aprovação.
 */
export const copyDocumentsToAttachments = async (
  request: DecisionRequest,
  userId: string
): Promise<void> => {
  const { data: docs } = await supabase
    .from('absence_documents')
    .select('*')
    .eq('absence_id', request.id);
  if (!docs || docs.length === 0) return;

  const label = absenceTypeLabels[request.absence_type] || 'Ausência';
  const day = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy', { locale: pt });
  const description = `${label} (${day(request.start_date)} - ${day(request.end_date)})`;

  for (const doc of docs) {
    const { data: file } = await supabase.storage.from('absence-documents').download(doc.file_path);
    if (!file) continue;
    const safeName = doc.file_name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '');
    const path = `${request.employee_id}/attachments/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('employee-files').upload(path, file);
    if (uploadError) continue;
    await supabase.from('employee_attachments').insert({
      employee_id: request.employee_id,
      file_name: doc.file_name,
      file_path: path,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      source: 'absence',
      description,
      uploaded_by: userId,
    });
  }
};

export const absenceDecisionService = {
  /**
   * Todos os pedidos (com períodos, n.º de documentos e quem decidiu) e os feriados deste ano
   * e do próximo.
   */
  list: async (): Promise<ServiceResult<RequestsData>> => {
    try {
      const year = new Date().getFullYear();
      const [requests, holidays] = await Promise.all([
        supabase.from('absences').select(REQUEST_COLUMNS).order('created_at', { ascending: false }),
        supabase
          .from('holidays')
          .select('*')
          .in('year', [year, year + 1]),
      ]);
      if (requests.error) throw requests.error;
      const rows = (requests.data ?? []) as unknown as RequestRow[];
      const approverIds = [
        ...new Set(rows.map(row => row.approved_by).filter(Boolean)),
      ] as string[];
      const { data: approvers } = approverIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', approverIds)
        : { data: [] };
      const names = new Map((approvers ?? []).map(row => [row.user_id, row.name ?? '']));
      const holidayList = (holidays.data ?? []) as Holiday[];
      return {
        data: {
          requests: rows.map(row => toRequest(row, holidayList, names)),
          holidays: holidayList,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Aprovar o pedido inteiro. Não aprova se o colaborador já tiver outra ausência aprovada
   * nalgum desses dias (devolve `conflict` com a explicação).
   */
  approve: async (
    request: DecisionRequest
  ): Promise<ServiceResult<{ conflict: string | null }>> => {
    try {
      const userId = await sessionUserId();
      const { data: fresh, error: freshError } = await supabase
        .from('absence_periods')
        .select('start_date, end_date, period_type, start_time, end_time')
        .eq('absence_id', request.id);
      if (freshError) throw freshError;
      const periods =
        fresh && fresh.length > 0
          ? fresh
          : [
              {
                start_date: request.start_date,
                end_date: request.end_date,
                period_type: 'full_day',
              },
            ];

      const { data: conflicts, error: conflictError } = await findApprovedConflicts(
        request.employee_id,
        periods,
        request.id
      );
      if (conflictError) throw conflictError;
      if (conflicts && conflicts.length > 0)
        return { data: { conflict: describeConflicts(conflicts) }, error: null };

      const { error } = await supabase
        .from('absences')
        .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
        .eq('id', request.id);
      if (error) throw error;
      const { error: periodsError } = await supabase
        .from('absence_periods')
        .update({ status: 'approved' })
        .eq('absence_id', request.id);
      if (periodsError) throw periodsError;

      await copyDocumentsToAttachments(request, userId);
      return { data: { conflict: null }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Rejeitar o pedido (motivo opcional, que o colaborador vê). */
  reject: async (request: DecisionRequest, reason: string): Promise<ServiceResult<true>> => {
    try {
      const userId = await sessionUserId();
      const { error } = await supabase
        .from('absences')
        .update({
          status: 'rejected',
          rejection_reason: reason.trim() || null,
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (error) throw error;
      const { error: periodsError } = await supabase
        .from('absence_periods')
        .update({ status: 'rejected' })
        .eq('absence_id', request.id);
      if (periodsError) throw periodsError;
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Voltar a pôr um pedido aprovado como pendente (os dias de férias voltam ao saldo). */
  unapprove: async (request: DecisionRequest, note: string): Promise<ServiceResult<true>> => {
    try {
      const { error } = await supabase
        .from('absences')
        .update({
          status: 'pending',
          approved_by: null,
          approved_at: null,
          rejection_reason: note.trim() || null,
        })
        .eq('id', request.id);
      if (error) throw error;
      const { error: periodsError } = await supabase
        .from('absence_periods')
        .update({ status: 'pending' })
        .eq('absence_id', request.id);
      if (periodsError) throw periodsError;
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Colegas da mesma empresa ausentes (aprovados ou por aprovar) nalgum dia do pedido. */
  overlaps: async (request: AbsenceRequest, start: string, end: string) => {
    try {
      const { data, error } = await supabase
        .from('absence_periods')
        .select(
          'start_date, end_date, absences!inner(status, absence_type, employee_id, employees!inner(name, company_id))'
        )
        .lte('start_date', end)
        .gte('end_date', start)
        .neq('status', 'rejected')
        .neq('absences.employee_id', request.employee_id)
        .in('absences.status', ['approved', 'partially_approved', 'pending'])
        .eq('absences.employees.company_id', request.company.id)
        .order('start_date');
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        start_date: string;
        end_date: string;
        absences: { status: string; absence_type: string; employees: { name: string } };
      }[];
      const overlaps: Overlap[] = rows.map(row => ({
        name: row.absences.employees.name,
        absenceType: row.absences.absence_type,
        start: row.start_date,
        end: row.end_date,
        pending: row.absences.status === 'pending',
      }));
      return { data: overlaps, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Saldo de férias de um ano (dias do ano e dias já gozados/aprovados). */
  vacationBalance: async (
    employeeId: string,
    year: number
  ): Promise<ServiceResult<VacationBalance | null>> => {
    try {
      const { data, error } = await supabase
        .from('employee_vacation_balances')
        .select('total_days, used_days')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .maybeSingle();
      if (error) throw error;
      return {
        data: data ? { total: Number(data.total_days), used: Number(data.used_days) } : null,
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },
};
