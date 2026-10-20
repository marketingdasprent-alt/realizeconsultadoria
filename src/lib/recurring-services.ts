import { addMonths, differenceInDays, format, parseISO, startOfDay } from 'date-fns';

/** Tipos de serviço recorrente geridos na tab "Serviços". */
export type ServiceType = 'internet' | 'subscription';

/** Periodicidade da cobrança. Define de quanto avança a renovação ao marcar como pago. */
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export const BILLING_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

/** Meses de cada ciclo. */
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  yearly: 'Anual',
};

/** "por mês", "por trimestre"… */
export const CYCLE_PER: Record<BillingCycle, string> = {
  monthly: 'por mês',
  quarterly: 'por trimestre',
  semiannual: 'por semestre',
  yearly: 'por ano',
};

/** Ciclo guardado na BD (texto) → ciclo conhecido (anual por omissão). */
export const toBillingCycle = (value: string | null | undefined): BillingCycle =>
  BILLING_CYCLES.includes(value as BillingCycle) ? (value as BillingCycle) : 'yearly';

/** Gravidade do estado, traduzida para cores pelo componente. */
export type StatusTone = 'ok' | 'soon' | 'urgent' | 'overdue' | 'ended';

export interface CycleStatus {
  label: string;
  tone: StatusTone;
  daysUntil: number;
}

/** Dias de antecedência com que se avisa do fim da fidelização (tempo para renegociar). */
export const FIDELITY_WARNING_DAYS = 60;

const plural = (days: number) => (days === 1 ? 'dia' : 'dias');

/** Avança a data de renovação um período (um mês, um trimestre, um ano…, conforme o ciclo). */
export function advanceRenewalDate(date: string, cycle: BillingCycle): string {
  return format(addMonths(parseISO(date), CYCLE_MONTHS[cycle]), 'yyyy-MM-dd');
}

/**
 * Próxima renovação a partir da data de início e do ciclo: o primeiro dia de pagamento que
 * ainda não passou (o próprio início, se for no futuro). Conta sempre a partir do início, para
 * o dia não "escorregar" nos fins de mês (31/01 → 28/02 → 31/03).
 */
export function nextRenewalFrom(
  startDate: string,
  cycle: BillingCycle,
  today: Date = new Date()
): string {
  const start = parseISO(startDate);
  const limit = startOfDay(today);
  let periods = 0;
  let next = start;
  while (next < limit) {
    periods += 1;
    next = addMonths(start, periods * CYCLE_MONTHS[cycle]);
  }
  return format(next, 'yyyy-MM-dd');
}

/**
 * O ciclo actual está pago quando avançar a última data paga um período dá exactamente
 * a próxima renovação — ou seja, quando a renovação já foi avançada uma vez.
 *
 * A comparação é feita para a frente, e não recuando a renovação, porque avançar meses
 * não é reversível no fim do mês: 31/01 avança para 28/02, mas 28/02 recua para 28/01.
 */
export function isCyclePaid(service: {
  renewal_date: string;
  billing_cycle: BillingCycle;
  last_paid_date: string | null;
}): boolean {
  if (!service.last_paid_date) return false;
  return advanceRenewalDate(service.last_paid_date, service.billing_cycle) === service.renewal_date;
}

/** Estado da próxima renovação face a hoje. */
export function getCycleStatus(renewalDate: string, today: Date = new Date()): CycleStatus {
  const daysUntil = differenceInDays(startOfDay(parseISO(renewalDate)), startOfDay(today));

  if (daysUntil < 0) {
    const late = Math.abs(daysUntil);
    return { label: `Expirado há ${late} ${plural(late)}`, tone: 'overdue', daysUntil };
  }
  if (daysUntil === 0) {
    return { label: 'Renova hoje', tone: 'urgent', daysUntil };
  }
  if (daysUntil <= 7) {
    return { label: `Renova em ${daysUntil} ${plural(daysUntil)}`, tone: 'urgent', daysUntil };
  }
  if (daysUntil <= 30) {
    return { label: `Renova em ${daysUntil} dias`, tone: 'soon', daysUntil };
  }
  return { label: 'Regular', tone: 'ok', daysUntil };
}

/** Estado da fidelização. Devolve null quando o serviço não tem fidelização registada. */
export function getFidelityStatus(
  fidelityEnd: string | null | undefined,
  today: Date = new Date()
): CycleStatus | null {
  if (!fidelityEnd) return null;

  const end = startOfDay(parseISO(fidelityEnd));
  const daysUntil = differenceInDays(end, startOfDay(today));

  if (daysUntil < 0) {
    return { label: 'Sem fidelização', tone: 'ended', daysUntil };
  }
  if (daysUntil <= FIDELITY_WARNING_DAYS) {
    return { label: `Acaba em ${daysUntil} ${plural(daysUntil)}`, tone: 'soon', daysUntil };
  }
  return { label: `Até ${format(end, 'dd/MM/yyyy')}`, tone: 'ok', daysUntil };
}
