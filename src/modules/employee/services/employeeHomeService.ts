import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { PAYSLIP_CATEGORY } from '@/lib/documents';
import type { HomeData, HomeNotice } from '@/lib/employee-home';

interface NoticeRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const noticesFilter = (companyId: string, employeeId: string) =>
  `and(company_id.is.null,employee_id.is.null),and(company_id.eq.${companyId},employee_id.is.null),employee_id.eq.${employeeId}`;

export const employeeHomeService = {
  /**
   * Avisos visíveis ao colaborador (globais, da empresa e individuais) com estado de leitura.
   */
  getNotices: async (companyId: string, employeeId: string) => {
    const [noticesRes, readsRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, message, created_at')
        .eq('is_active', true)
        .or(noticesFilter(companyId, employeeId))
        .order('created_at', { ascending: false }),
      supabase.from('notification_reads').select('notification_id').eq('employee_id', employeeId),
    ]);
    const read = new Set((readsRes.data ?? []).map(r => r.notification_id));
    const notices: HomeNotice[] = ((noticesRes.data ?? []) as NoticeRow[]).map(n => ({
      ...n,
      read: read.has(n.id),
    }));
    return { data: notices, error: noticesRes.error ?? readsRes.error };
  },

  /**
   * Marca avisos como lidos (ignora os já marcados).
   */
  markNoticesRead: async (employeeId: string, noticeIds: string[]) => {
    if (noticeIds.length === 0) return { success: true, error: null };
    const { error } = await supabase.from('notification_reads').upsert(
      noticeIds.map(id => ({ employee_id: employeeId, notification_id: id })),
      { onConflict: 'employee_id,notification_id', ignoreDuplicates: true }
    );
    return { success: !error, error };
  },

  /**
   * Tudo o que o Início precisa, em paralelo.
   */
  getHomeData: async (
    companyId: string,
    employeeId: string
  ): Promise<{ data: HomeData; error: unknown }> => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const year = new Date().getFullYear();
    const recent = addDays(new Date(), -14).toISOString();

    const [pendingRes, nextRes, balanceRes, noticesRes, holidayRes, docsRes, ticketsRes] =
      await Promise.all([
        supabase
          .from('absences')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId)
          .eq('status', 'pending'),
        supabase
          .from('absences')
          .select('start_date, end_date, absence_type')
          .eq('employee_id', employeeId)
          .in('status', ['approved', 'partially_approved'])
          .gte('end_date', today)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('employee_vacation_balances')
          .select('total_days, used_days')
          .eq('employee_id', employeeId)
          .eq('year', year)
          .maybeSingle(),
        employeeHomeService.getNotices(companyId, employeeId),
        supabase
          .from('holidays')
          .select('date, name')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('employee_documents')
          .select('status, uploaded_by_role, created_at, category')
          .eq('employee_id', employeeId),
        supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId)
          .in('status', ['open', 'in_progress']),
      ]);

    const docs = docsRes.data ?? [];
    const data: HomeData = {
      pendingRequests: pendingRes.count ?? 0,
      nextAbsence: nextRes.data ?? null,
      balance: balanceRes.data ?? null,
      notices: noticesRes.data.slice(0, 3),
      unreadNotices: noticesRes.data.filter(n => !n.read).length,
      nextHoliday: holidayRes.data ?? null,
      newDocuments: docs.filter(
        d =>
          d.status === 'approved' &&
          d.uploaded_by_role !== 'employee' &&
          d.category !== PAYSLIP_CATEGORY &&
          d.created_at >= recent
      ).length,
      rejectedDocuments: docs.filter(d => d.status === 'rejected').length,
      pendingDocuments: docs.filter(d => d.status === 'pending').length,
      openTickets: ticketsRes.count ?? 0,
    };
    const error =
      pendingRes.error ?? nextRes.error ?? balanceRes.error ?? holidayRes.error ?? docsRes.error;
    return { data, error };
  },
};
