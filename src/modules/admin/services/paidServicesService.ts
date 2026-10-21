import { supabase } from '@/integrations/supabase/client';
import { parseAmount, renewalFor, type PaidForm } from '../lib/paidServiceForm';
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
          .select('id, domain_name, renewal_value, renewal_date, last_paid_year, start_date'),
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

  /**
   * Cria ou atualiza (domínio em site_domains; internet/assinatura em recurring_services). A
   * renovação vem do início e do ciclo; sem mudar esses dois, fica o estado "pago".
   */
  save: async (form: PaidForm, existing: PaidService | null): Promise<ServiceResult<true>> => {
    const amount = parseAmount(form.amount) ?? 0;
    const { renewalDate, keepPaid } = renewalFor(form, existing);
    if (form.kind === 'domain') {
      const payload = {
        domain_name: form.name.trim().toLowerCase(),
        renewal_value: amount,
        renewal_date: renewalDate,
        start_date: form.startDate,
        ...(keepPaid ? {} : { last_paid_year: null }),
      };
      const { error } = existing
        ? await supabase.from('site_domains').update(payload).eq('id', existing.id)
        : await supabase.from('site_domains').insert(payload);
      return { data: error ? null : true, error };
    }
    const payload = {
      service_type: form.kind,
      name: form.name.trim(),
      provider: form.provider.trim() || null,
      company_id: form.companyId || null,
      location: form.kind === 'internet' ? form.location.trim() || null : null,
      amount,
      billing_cycle: form.cycle,
      renewal_date: renewalDate,
      start_date: form.startDate,
      fidelity_end: form.kind === 'internet' && form.fidelityEnd ? form.fidelityEnd : null,
      notes: form.notes.trim() || null,
      ...(keepPaid ? {} : { last_paid_date: null }),
    };
    const { error } = existing
      ? await supabase.from('recurring_services').update(payload).eq('id', existing.id)
      : await supabase.from('recurring_services').insert(payload);
    return { data: error ? null : true, error };
  },

  remove: async (service: PaidService): Promise<ServiceResult<true>> => {
    const { error } = await supabase.from(tableOf(service)).delete().eq('id', service.id);
    return { data: error ? null : true, error };
  },
};
