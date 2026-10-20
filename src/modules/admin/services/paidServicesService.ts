import { supabase } from '@/integrations/supabase/client';
import {
  fromDomain,
  fromService,
  togglePaidPatch,
  type PaidService,
  type ServiceRow,
} from '../lib/paidServices';

interface ServiceResult<T> {
  data: T | null;
  error: unknown;
}

const tableOf = (service: PaidService) =>
  service.source === 'domain' ? 'site_domains' : 'recurring_services';

export const paidServicesService = {
  /** Domínios e serviços recorrentes, já no formato comum. */
  list: async (): Promise<ServiceResult<PaidService[]>> => {
    try {
      const [domains, services] = await Promise.all([
        supabase
          .from('site_domains')
          .select('id, domain_name, renewal_value, renewal_date, last_paid_year'),
        supabase.from('recurring_services').select('*, companies(name)'),
      ]);
      if (domains.error) throw domains.error;
      if (services.error) throw services.error;
      return {
        data: [
          ...(domains.data ?? []).map(fromDomain),
          ...((services.data ?? []) as unknown as ServiceRow[]).map(fromService),
        ],
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Marca o período atual como pago (avança a renovação) ou desfaz. */
  togglePaid: async (service: PaidService): Promise<ServiceResult<true>> => {
    const { table, patch } = togglePaidPatch(service);
    const { error } =
      table === 'site_domains'
        ? await supabase.from('site_domains').update(patch).eq('id', service.id)
        : await supabase.from('recurring_services').update(patch).eq('id', service.id);
    return { data: error ? null : true, error };
  },

  remove: async (service: PaidService): Promise<ServiceResult<true>> => {
    const { error } = await supabase.from(tableOf(service)).delete().eq('id', service.id);
    return { data: error ? null : true, error };
  },
};
