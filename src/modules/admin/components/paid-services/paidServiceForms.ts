// Ponte entre a lista comum e as janelas de edição de cada tabela (DomainModal, ServiceModal).
import type { DomainData } from '@/components/admin/domains/DomainModal';
import type { ServiceData } from '@/components/admin/services/ServiceModal';
import { parseISO } from 'date-fns';
import type { PaidKind, PaidService } from '../../lib/paidServices';

export type PaidEditor =
  | { kind: 'domain'; domain: DomainData | null }
  | { kind: 'service'; service: ServiceData | null }
  | null;

export const toDomainData = (service: PaidService): DomainData => ({
  id: service.id,
  domain_name: service.name,
  renewal_value: service.amount,
  renewal_date: service.renewalDate,
  last_paid_year: service.paid ? parseISO(service.renewalDate).getFullYear() - 1 : null,
});

export const toServiceData = (service: PaidService): ServiceData => ({
  id: service.id,
  service_type: service.kind === 'internet' ? 'internet' : 'subscription',
  name: service.name,
  provider: service.provider,
  company_id: service.companyId,
  location: service.location,
  amount: service.amount,
  billing_cycle: service.cycle,
  renewal_date: service.renewalDate,
  last_paid_date: service.lastPaidDate,
  fidelity_end: service.fidelityEnd,
  notes: service.notes,
});

/** Janela para editar um serviço existente. */
export const editorFor = (service: PaidService): PaidEditor =>
  service.source === 'domain'
    ? { kind: 'domain', domain: toDomainData(service) }
    : { kind: 'service', service: toServiceData(service) };

/** Janela para criar um serviço do tipo escolhido (a de serviços já vem com o tipo). */
export const newEditor = (kind: PaidKind): PaidEditor =>
  kind === 'domain'
    ? { kind: 'domain', domain: null }
    : {
        kind: 'service',
        service: {
          service_type: kind,
          name: '',
          provider: '',
          company_id: null,
          location: '',
          amount: 0,
          billing_cycle: kind === 'internet' ? 'monthly' : 'yearly',
          renewal_date: '',
          fidelity_end: null,
          notes: '',
        },
      };
