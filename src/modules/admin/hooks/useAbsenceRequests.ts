import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { absenceDecisionService, type RequestsData } from '../services/absenceDecisionService';
import type { AbsenceRequest } from '../lib/absenceRequests';

export const ABSENCE_REQUESTS_KEY = ['admin', 'absence-requests'] as const;

export interface ApproveOutcome {
  approved: AbsenceRequest[];
  /** Pedidos não aprovados por já haver outra ausência aprovada nesses dias. */
  conflicts: { request: AbsenceRequest; reason: string }[];
  failed: AbsenceRequest[];
}

/**
 * Pedidos de ausência do admin, em cache (abre logo e atualiza a cada minuto). Aprovar,
 * rejeitar e desaprovar mudam a linha na hora; a lista, o menu e o calendário atualizam a
 * seguir.
 */
export const useAbsenceRequests = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ABSENCE_REQUESTS_KEY,
    queryFn: async (): Promise<RequestsData> => {
      const { data, error } = await absenceDecisionService.list();
      if (error || !data) throw error ?? new Error('Sem pedidos');
      return data;
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const setStatus = useCallback(
    (ids: string[], status: string) =>
      queryClient.setQueryData<RequestsData>(ABSENCE_REQUESTS_KEY, current =>
        current
          ? {
              ...current,
              requests: current.requests.map(request =>
                ids.includes(request.id) ? { ...request, status } : request
              ),
            }
          : current
      ),
    [queryClient]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ABSENCE_REQUESTS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] }),
    ]);
  }, [queryClient]);

  /** Aprova um ou vários pedidos (um de cada vez, para respeitar os conflitos entre eles). */
  const approve = useCallback(
    async (requests: AbsenceRequest[]): Promise<ApproveOutcome> => {
      const outcome: ApproveOutcome = { approved: [], conflicts: [], failed: [] };
      setStatus(
        requests.map(request => request.id),
        'approved'
      );
      for (const request of requests) {
        const { data, error } = await absenceDecisionService.approve(request);
        if (error || !data) outcome.failed.push(request);
        else if (data.conflict) outcome.conflicts.push({ request, reason: data.conflict });
        else outcome.approved.push(request);
      }
      const notApproved = [...outcome.failed, ...outcome.conflicts.map(item => item.request)];
      if (notApproved.length > 0)
        setStatus(
          notApproved.map(request => request.id),
          'pending'
        );
      void refresh();
      return outcome;
    },
    [refresh, setStatus]
  );

  /** Rejeita um ou vários pedidos com o mesmo motivo; devolve os que falharam. */
  const reject = useCallback(
    async (requests: AbsenceRequest[], reason: string): Promise<AbsenceRequest[]> => {
      setStatus(
        requests.map(request => request.id),
        'rejected'
      );
      const failed: AbsenceRequest[] = [];
      for (const request of requests) {
        const { error } = await absenceDecisionService.reject(request, reason);
        if (error) failed.push(request);
      }
      void refresh();
      return failed;
    },
    [refresh, setStatus]
  );

  const unapprove = useCallback(
    async (request: AbsenceRequest, note: string) => {
      setStatus([request.id], 'pending');
      const { error } = await absenceDecisionService.unapprove(request, note);
      void refresh();
      return !error;
    },
    [refresh, setStatus]
  );

  return {
    requests: query.data?.requests ?? [],
    holidays: query.data?.holidays ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refresh,
    approve,
    reject,
    unapprove,
  };
};
