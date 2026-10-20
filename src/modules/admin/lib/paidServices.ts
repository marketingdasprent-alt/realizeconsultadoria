// Acessos → Serviços pagos: domínios (site_domains) e serviços recorrentes (internet,
// assinaturas — recurring_services) numa só lista. As duas tabelas continuam separadas na BD
// (o admin antigo ainda usa site_domains); aqui só se juntam para mostrar e decidir.
import { addYears, format, parseISO, subYears } from 'date-fns';
import {
  advanceRenewalDate,
  CYCLE_MONTHS,
  toBillingCycle,
  getCycleStatus,
  isCyclePaid,
  type BillingCycle,
  type CycleStatus,
} from '@/lib/recurring-services';
import { matchesSearch } from '@/lib/utils';

export type PaidKind = 'domain' | 'internet' | 'subscription';

export const PAID_KIND_LABELS: Record<PaidKind, string> = {
  domain: 'Domínio',
  internet: 'Internet',
  subscription: 'Assinatura',
};

export interface DomainRow {
  id: string;
  domain_name: string;
  renewal_value: number;
  renewal_date: string;
  last_paid_year: number | null;
  start_date?: string | null;
}

export interface ServiceRow {
  id: string;
  service_type: string;
  name: string;
  provider: string | null;
  company_id: string | null;
  location: string | null;
  amount: number;
  billing_cycle: string;
  renewal_date: string;
  last_paid_date: string | null;
  fidelity_end: string | null;
  notes: string | null;
  start_date?: string | null;
  companies?: { name: string } | null;
}

export interface PaidService {
  /** Único entre as duas tabelas. */
  key: string;
  id: string;
  source: 'domain' | 'service';
  kind: PaidKind;
  name: string;
  provider: string | null;
  companyId: string | null;
  companyName: string | null;
  location: string | null;
  amount: number;
  cycle: BillingCycle;
  renewalDate: string;
  paid: boolean;
  fidelityEnd: string | null;
  notes: string | null;
  /** Para desfazer o pagamento de um serviço (a data guardada antes de avançar). */
  lastPaidDate: string | null;
  /** Data de início (a renovação calcula-se a partir dela e do ciclo); antigos não têm. */
  startDate: string | null;
}

export const fromDomain = (row: DomainRow): PaidService => ({
  key: `domain:${row.id}`,
  id: row.id,
  source: 'domain',
  kind: 'domain',
  name: row.domain_name,
  provider: null,
  companyId: null,
  companyName: null,
  location: null,
  amount: Number(row.renewal_value),
  cycle: 'yearly',
  renewalDate: row.renewal_date,
  // A renovação do ciclo atual está paga quando a data já foi avançada um ano.
  paid: row.last_paid_year === parseISO(row.renewal_date).getFullYear() - 1,
  fidelityEnd: null,
  notes: null,
  lastPaidDate: null,
  startDate: row.start_date ?? null,
});

export const fromService = (row: ServiceRow): PaidService => {
  const cycle: BillingCycle = toBillingCycle(row.billing_cycle);
  return {
    key: `service:${row.id}`,
    id: row.id,
    source: 'service',
    kind: row.service_type === 'internet' ? 'internet' : 'subscription',
    name: row.name,
    provider: row.provider,
    companyId: row.company_id,
    companyName: row.companies?.name ?? null,
    location: row.location,
    amount: Number(row.amount),
    cycle,
    renewalDate: row.renewal_date,
    paid: isCyclePaid({
      renewal_date: row.renewal_date,
      billing_cycle: cycle,
      last_paid_date: row.last_paid_date,
    }),
    fidelityEnd: row.fidelity_end,
    notes: row.notes,
    lastPaidDate: row.last_paid_date,
    startDate: row.start_date ?? null,
  };
};

/** Custo mensal equivalente (o valor do ciclo dividido pelos meses do ciclo). */
export const monthlyCost = (service: Pick<PaidService, 'amount' | 'cycle'>): number =>
  service.amount / CYCLE_MONTHS[service.cycle];

export interface PaidFilters {
  kind: PaidKind | 'all';
  companyId: string;
  search: string;
}

/** Filtra e ordena pela próxima renovação (as em atraso e as mais próximas primeiro). */
export const filterPaid = (services: PaidService[], filters: PaidFilters): PaidService[] =>
  services
    .filter(
      service =>
        (filters.kind === 'all' || service.kind === filters.kind) &&
        (filters.companyId === 'all' || service.companyId === filters.companyId) &&
        matchesSearch(
          [service.name, service.provider, service.location, service.companyName]
            .filter(Boolean)
            .join(' '),
          filters.search
        )
    )
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate) || a.name.localeCompare(b.name));

export interface PaidSummary {
  perMonth: number;
  perYear: number;
  /** Por pagar com renovação nos próximos 30 dias (ou já passada). */
  dueSoon: number;
  dueSoonAmount: number;
  overdue: number;
}

export const summarizePaid = (services: PaidService[], today = new Date()): PaidSummary => {
  const summary = { perMonth: 0, perYear: 0, dueSoon: 0, dueSoonAmount: 0, overdue: 0 };
  for (const service of services) {
    const monthly = monthlyCost(service);
    summary.perMonth += monthly;
    summary.perYear += monthly * 12;
    const { daysUntil } = getCycleStatus(service.renewalDate, today);
    if (!service.paid && daysUntil <= 30) {
      summary.dueSoon += 1;
      summary.dueSoonAmount += service.amount;
      if (daysUntil < 0) summary.overdue += 1;
    }
  }
  return summary;
};

/** Estado da renovação; pago fica "Pago" em vez de contar os dias. */
export const paidStatus = (service: PaidService, today = new Date()): CycleStatus =>
  getCycleStatus(service.renewalDate, today);

export type PaidToggle =
  | { table: 'site_domains'; patch: { renewal_date: string; last_paid_year: number | null } }
  | {
      table: 'recurring_services';
      patch: { renewal_date: string; last_paid_date: string | null };
    };

/**
 * Marcar como pago avança a próxima renovação um período (mês ou ano) e regista o período
 * pago; voltar a clicar desfaz. Nos serviços desfazer repõe a data guardada (recuar meses
 * perde o dia nos fins de mês).
 */
export const togglePaidPatch = (service: PaidService): PaidToggle => {
  if (service.source === 'domain') {
    const renewal = parseISO(service.renewalDate);
    return {
      table: 'site_domains',
      patch: {
        renewal_date: format(
          service.paid ? subYears(renewal, 1) : addYears(renewal, 1),
          'yyyy-MM-dd'
        ),
        last_paid_year: service.paid ? null : renewal.getFullYear(),
      },
    };
  }
  return {
    table: 'recurring_services',
    patch: service.paid
      ? { renewal_date: service.lastPaidDate ?? service.renewalDate, last_paid_date: null }
      : {
          renewal_date: advanceRenewalDate(service.renewalDate, service.cycle),
          last_paid_date: service.renewalDate,
        },
  };
};

/** "32,90 €" */
export const formatEuro = (value: number): string =>
  value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
