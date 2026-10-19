// Pedidos de férias e ausências do colaborador (as mesmas consultas da página antiga).
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import type { Holiday } from '@/lib/vacation-utils';
import type { AbsenceRow, VacationBalance } from '../lib/absenceRules';

export interface AbsencesData {
  absences: AbsenceRow[];
  holidays: Holiday[];
  balance: VacationBalance | null;
  /** Férias marcadas pelo próprio (pendentes + aprovadas), para a quota própria. */
  scheduledByEmployee: number;
  /** Dias de férias em pedidos pendentes. */
  pendingVacationDays: number;
}

type PeriodRow = {
  start_date: string;
  end_date: string;
  business_days: number;
  period_type: string;
  start_time: string | null;
  end_time: string | null;
};

const sumDays = (absences: (AbsenceRow & { created_by_role?: string | null })[]) =>
  absences.reduce(
    (total, absence) =>
      total + (absence.absence_periods ?? []).reduce((sum, p) => sum + Number(p.business_days), 0),
    0
  );

export const absenceRequestService = {
  /** Pedidos (com períodos e nº de anexos), feriados deste ano e do próximo e o saldo. */
  load: async (employeeId: string, year: number) => {
    const [absencesRes, holidaysRes, balanceRes] = await Promise.all([
      supabase
        .from('absences')
        // A contagem dos anexos vem no mesmo pedido (antes era um pedido a seguir a este).
        .select('*, absence_periods(*), absence_documents(count)')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false }),
      supabase
        .from('holidays')
        .select('*')
        .gte('year', year)
        .lte('year', year + 1),
      supabase
        .from('employee_vacation_balances')
        .select('total_days, used_days, self_schedulable_days')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .maybeSingle(),
    ]);
    const error = absencesRes.error ?? holidaysRes.error ?? balanceRes.error;
    if (error) return { data: null, error };

    const rows = (absencesRes.data ?? []) as unknown as (AbsenceRow & {
      created_by_role?: string | null;
      absence_documents?: { count: number }[];
    })[];

    const vacations = rows.filter(a => a.absence_type === 'vacation');
    const data: AbsencesData = {
      absences: rows.map(({ absence_documents, ...a }) => ({
        ...a,
        document_count: absence_documents?.[0]?.count ?? 0,
      })),
      holidays: (holidaysRes.data ?? []) as Holiday[],
      balance: balanceRes.data,
      scheduledByEmployee: sumDays(
        vacations.filter(
          a =>
            a.created_by_role === 'employee' && (a.status === 'pending' || a.status === 'approved')
        )
      ),
      pendingVacationDays: sumDays(vacations.filter(a => a.status === 'pending')),
    };
    return { data, error: null };
  },

  /** Já existe um pedido pendente que cobre estas datas? */
  hasPendingOverlap: async (employeeId: string, from: Date, to: Date) => {
    const { data, error } = await supabase
      .from('absences')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('status', 'pending')
      .lte('start_date', format(to, 'yyyy-MM-dd'))
      .gte('end_date', format(from, 'yyyy-MM-dd'))
      .limit(1);
    return { data: (data?.length ?? 0) > 0, error };
  },

  create: async (input: {
    employeeId: string;
    companyId: string;
    absenceType: string;
    trainingMode: string | null;
    notes: string | null;
    from: Date;
    to: Date;
    periods: PeriodRow[];
  }) => {
    const { data: absence, error } = await supabase
      .from('absences')
      .insert({
        employee_id: input.employeeId,
        company_id: input.companyId,
        start_date: format(input.from, 'yyyy-MM-dd'),
        end_date: format(input.to, 'yyyy-MM-dd'),
        absence_type: input.absenceType,
        notes: input.notes,
        training_mode: input.absenceType === 'training' ? input.trainingMode : null,
      })
      .select('id')
      .single();
    if (error || !absence) return { data: null, error };
    const { error: periodsError } = await supabase
      .from('absence_periods')
      .insert(input.periods.map(period => ({ ...period, absence_id: absence.id })));
    return { data: absence.id, error: periodsError };
  },

  /** Comprovativos no bucket privado absence-documents; devolve quantos falharam. */
  uploadDocuments: async (userId: string, absenceId: string, files: File[]) => {
    const results = await Promise.all(
      files.map(async file => {
        const path = `${userId}/${absenceId}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const upload = await supabase.storage.from('absence-documents').upload(path, file);
        if (upload.error) return false;
        const { error } = await supabase.from('absence_documents').insert({
          absence_id: absenceId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: userId,
        });
        return !error;
      })
    );
    return results.filter(ok => !ok).length;
  },

  /** Email aos RH (não espera pela resposta, como antes). */
  notifyHR: (body: {
    employeeName: string;
    employeeEmail: string;
    companyName: string;
    absenceType: string;
    periods: { startDate: string; endDate: string; businessDays: number }[];
    notes?: string;
  }) => {
    supabase.functions
      .invoke('send-absence-notification', { body })
      .catch(error => console.error('Falhou o email aos RH:', error));
  },

  /**
   * Muda as datas de um período de férias (aprovado ou pendente, que ainda não começou).
   * As regras estão na base de dados (reschedule_vacation_period).
   */
  reschedulePeriod: async (
    periodId: string,
    input: {
      startDate: string;
      endDate: string;
      periodType: 'full_day' | 'partial';
      startTime: string | null;
      endTime: string | null;
    }
  ) => {
    const { data, error } = await supabase.rpc('reschedule_vacation_period', {
      p_period_id: periodId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_period_type: input.periodType,
      p_start_time: input.startTime ?? undefined,
      p_end_time: input.endTime ?? undefined,
    });
    return { data, error };
  },

  /** Cancela um período de um pedido pendente ou rejeitado (o único = o pedido todo). */
  cancelPeriod: async (periodId: string) => {
    const { error } = await supabase.rpc('cancel_absence_period', { p_period_id: periodId });
    return { error };
  },

  /** Cancela (apaga) um pedido pendente ou rejeitado, com os períodos e os anexos. */
  cancel: async (absenceId: string) => {
    await supabase.from('absence_documents').delete().eq('absence_id', absenceId);
    await supabase.from('absence_periods').delete().eq('absence_id', absenceId);
    const { error } = await supabase.from('absences').delete().eq('id', absenceId);
    return { error };
  },
};
