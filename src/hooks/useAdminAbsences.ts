import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { countBusinessDays, type Holiday } from '@/lib/vacation-utils';

export interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status?: string;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
}

export interface AbsenceRequest {
  id: string;
  status: string;
  absence_type: string;
  notes: string | null;
  rejection_reason?: string | null;
  created_at: string;
  start_date: string;
  end_date: string;
  employee_id: string;
  total_business_days?: number;
  document_count?: number;
  approved_by?: string | null;
  approver_name?: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  company: {
    id: string;
    name: string;
  };
  periods: AbsencePeriod[];
}

export const useAdminAbsences = (statusFilter: string) => {
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHolidays = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .in('year', [currentYear, currentYear + 1]);
    setHolidays(data || []);
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const fetchRequests = useCallback(
    async (retryCount = 0) => {
      if (holidays.length === 0 && retryCount === 0) return; // Wait for holidays

      setIsLoading(true);
      try {
        let query = supabase
          .from('absences')
          .select(
            `
          id,
          status,
          absence_type,
          notes,
          rejection_reason,
          created_at,
          start_date,
          end_date,
          employee_id,
          approved_by,
          employees!inner (
            id,
            name,
            email,
            companies!inner (
              id,
              name
            )
          )
        `
          )
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          if (statusFilter === 'approved') {
            query = query.in('status', ['approved', 'partially_approved']);
          } else {
            query = query.eq('status', statusFilter);
          }
        }

        const { data, error } = await query;

        if (error) throw error;

        // Fetch periods for each absence
        const absenceIds = data?.map(a => a.id) || [];
        const approverIds = data?.map(a => a.approved_by).filter(Boolean) as string[];

        // Fetch periods, document counts, and approver names in parallel
        const [periodsResult, docsResult, approversResult] = await Promise.all([
          supabase.from('absence_periods').select('*').in('absence_id', absenceIds),
          supabase.from('absence_documents').select('absence_id').in('absence_id', absenceIds),
          approverIds.length > 0
            ? supabase.from('profiles').select('user_id, name').in('user_id', approverIds)
            : Promise.resolve({ data: [] }),
        ]);

        if (periodsResult.error) throw periodsResult.error;

        const periodsData = periodsResult.data;
        const docsData = docsResult.data || [];
        const approversData = approversResult.data || [];

        // Build document count map
        const docCountMap = docsData.reduce(
          (acc, doc) => {
            acc[doc.absence_id] = (acc[doc.absence_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // Build approver name map
        const approverNameMap = approversData.reduce(
          (acc, profile) => {
            acc[profile.user_id] = profile.name;
            return acc;
          },
          {} as Record<string, string>
        );

        const formattedRequests: AbsenceRequest[] = (data || []).map(absence => {
          const absencePeriods = (periodsData || []).filter(p => p.absence_id === absence.id);
          const hasPeriods = absencePeriods.length > 0;

          // Calculate business days from main absence dates if no periods exist
          const totalBusinessDays = hasPeriods
            ? absencePeriods.reduce((sum, p) => sum + Number(p.business_days), 0)
            : countBusinessDays(new Date(absence.start_date), new Date(absence.end_date), holidays);

          return {
            id: absence.id,
            status: absence.status,
            absence_type: absence.absence_type,
            notes: absence.notes,
            rejection_reason: (absence as any).rejection_reason || null,
            created_at: absence.created_at,
            start_date: absence.start_date,
            end_date: absence.end_date,
            employee_id: absence.employee_id,
            total_business_days: totalBusinessDays,
            document_count: docCountMap[absence.id] || 0,
            approved_by: absence.approved_by,
            approver_name: absence.approved_by
              ? approverNameMap[absence.approved_by] || null
              : null,
            employee: {
              // @ts-expect-error - Data typing from Supabase relational query
              id: absence.employees.id,
              // @ts-expect-error - Data typing from Supabase relational query
              name: absence.employees.name,
              // @ts-expect-error - Data typing from Supabase relational query
              email: absence.employees.email,
            },
            company: {
              // @ts-expect-error - Data typing from Supabase relational query
              id: absence.employees.companies.id,
              // @ts-expect-error - Data typing from Supabase relational query
              name: absence.employees.companies.name,
            },
            periods: absencePeriods,
          };
        });

        setRequests(formattedRequests);
      } catch (error: any) {
        console.error('Error fetching requests:', error);

        // Retry once on network failure
        const isNetworkError =
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.name === 'TypeError';

        if (isNetworkError && retryCount < 1) {
          setTimeout(() => fetchRequests(retryCount + 1), 1000);
          return;
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, holidays]
  );

  useEffect(() => {
    if (holidays.length > 0) {
      fetchRequests();
    }
  }, [fetchRequests, holidays, statusFilter]);

  const unapproveRequest = async (request: AbsenceRequest, note: string) => {
    // Update absence status to pending and clear approval fields
    const { error: absenceError } = await supabase
      .from('absences')
      .update({
        status: 'pending',
        approved_by: null,
        approved_at: null,
        rejection_reason: note.trim() || null,
      })
      .eq('id', request.id);

    if (absenceError) throw absenceError;

    // Update all periods to pending
    const { error: periodsError } = await supabase
      .from('absence_periods')
      .update({ status: 'pending' })
      .eq('absence_id', request.id);

    if (periodsError) throw periodsError;

    await fetchRequests();
  };

  return {
    requests,
    holidays,
    isLoading,
    refetch: fetchRequests,
    unapproveRequest,
  };
};
