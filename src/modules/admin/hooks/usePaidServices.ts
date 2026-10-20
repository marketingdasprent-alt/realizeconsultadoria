import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fromDomain, togglePaidPatch, type PaidService } from '../lib/paidServices';
import { paidServicesService } from '../services/paidServicesService';
import { isCyclePaid } from '@/lib/recurring-services';

export const PAID_SERVICES_KEY = ['admin', 'paid-services'] as const;

/** O serviço depois de marcar/desmarcar como pago (para mostrar logo, antes da BD). */
const afterToggle = (service: PaidService): PaidService => {
  const { patch } = togglePaidPatch(service);
  if ('last_paid_year' in patch) {
    return fromDomain({
      id: service.id,
      domain_name: service.name,
      renewal_value: service.amount,
      renewal_date: patch.renewal_date,
      last_paid_year: patch.last_paid_year,
    });
  }
  return {
    ...service,
    renewalDate: patch.renewal_date,
    lastPaidDate: patch.last_paid_date,
    paid: isCyclePaid({
      renewal_date: patch.renewal_date,
      billing_cycle: service.cycle,
      last_paid_date: patch.last_paid_date,
    }),
  };
};

/** Serviços pagos (domínios + serviços recorrentes), com "pago" e remover imediatos. */
export const usePaidServices = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: PAID_SERVICES_KEY,
    queryFn: async () => {
      const { data, error } = await paidServicesService.list();
      if (error || !data) throw error ?? new Error('Sem serviços');
      return data;
    },
    staleTime: 60_000,
  });

  const replace = useCallback(
    (update: (list: PaidService[]) => PaidService[]) =>
      queryClient.setQueryData<PaidService[]>(PAID_SERVICES_KEY, list =>
        list ? update(list) : list
      ),
    [queryClient]
  );
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PAID_SERVICES_KEY }),
    [queryClient]
  );

  const togglePaid = useCallback(
    async (service: PaidService) => {
      const next = afterToggle(service);
      replace(list => list.map(item => (item.key === service.key ? next : item)));
      const { error } = await paidServicesService.togglePaid(service);
      void refresh();
      return { next, error };
    },
    [refresh, replace]
  );

  const remove = useCallback(
    async (service: PaidService) => {
      replace(list => list.filter(item => item.key !== service.key));
      const { error } = await paidServicesService.remove(service);
      void refresh();
      return !error;
    },
    [refresh, replace]
  );

  return {
    services: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refresh,
    togglePaid,
    remove,
  };
};
