import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { absenceDecisionService } from '../services/absenceDecisionService';
import { groupOverlaps, requestSpan, type AbsenceRequest } from '../lib/absenceRequests';

/**
 * O que ajuda a decidir um pedido: quem mais da empresa está fora nesses dias e, nas férias,
 * o saldo do colaborador nesse ano.
 */
export const useRequestContext = (request: AbsenceRequest | null) => {
  const span = request ? requestSpan(request) : null;
  const year = span ? parseISO(span.start).getFullYear() : 0;

  const overlaps = useQuery({
    queryKey: ['admin', 'absence-requests', 'overlaps', request?.id, span?.start, span?.end],
    queryFn: async () => {
      const { data, error } = await absenceDecisionService.overlaps(
        request!,
        span!.start,
        span!.end
      );
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!request && !!span,
    staleTime: 60_000,
  });

  const balance = useQuery({
    queryKey: ['admin', 'absence-requests', 'balance', request?.employee_id, year],
    queryFn: async () => {
      const { data, error } = await absenceDecisionService.vacationBalance(
        request!.employee_id,
        year
      );
      if (error) throw error;
      return data;
    },
    enabled: !!request && request.absence_type === 'vacation',
    staleTime: 60_000,
  });

  const periods =
    request && request.periods.length > 0
      ? request.periods.filter(period => period.status !== 'rejected')
      : span
        ? [{ start_date: span.start, end_date: span.end }]
        : [];

  return {
    people: groupOverlaps(overlaps.data ?? [], periods),
    overlapsLoading: overlaps.isLoading,
    balance: balance.data ?? null,
    year,
  };
};
