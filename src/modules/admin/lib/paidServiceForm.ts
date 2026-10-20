// Janela de serviço pago (domínio, internet, assinatura): o formulário, a validação e o que
// se grava. Indica-se a data de início e o ciclo; a próxima renovação calcula-se daí.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { nextRenewalFrom, type BillingCycle } from '@/lib/recurring-services';
import type { PaidKind, PaidService } from './paidServices';

export interface PaidForm {
  kind: PaidKind;
  name: string;
  provider: string;
  companyId: string;
  location: string;
  /** Texto como foi escrito ("32,90"). */
  amount: string;
  cycle: BillingCycle;
  startDate: string;
  fidelityEnd: string;
  notes: string;
}

export const emptyPaidForm = (kind: PaidKind): PaidForm => ({
  kind,
  name: '',
  provider: '',
  companyId: '',
  location: '',
  amount: '',
  cycle: kind === 'internet' ? 'monthly' : 'yearly',
  startDate: '',
  fidelityEnd: '',
  notes: '',
});

/** Os antigos não têm data de início: usa-se a próxima renovação (o dia de pagamento). */
export const paidFormFrom = (service: PaidService): PaidForm => ({
  kind: service.kind,
  name: service.name,
  provider: service.provider ?? '',
  companyId: service.companyId ?? '',
  location: service.location ?? '',
  amount: String(service.amount).replace('.', ','),
  cycle: service.cycle,
  startDate: service.startDate ?? service.renewalDate,
  fidelityEnd: service.fidelityEnd ?? '',
  notes: service.notes ?? '',
});

export const parseAmount = (value: string): number | null => {
  const number = Number(value.replace(/\s/g, '').replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : null;
};

export type PaidFormErrors = Partial<Record<'name' | 'amount' | 'startDate', string>>;

export const validatePaidForm = (form: PaidForm): PaidFormErrors => {
  const errors: PaidFormErrors = {};
  if (!form.name.trim())
    errors.name = form.kind === 'domain' ? 'Indique o domínio.' : 'Indique o nome.';
  if (parseAmount(form.amount) === null) errors.amount = 'Valor inválido.';
  if (!form.startDate) errors.startDate = 'Indique a data de início.';
  return errors;
};

/**
 * Próxima renovação e o registo do pagamento a gravar: sem mudar o início nem o ciclo,
 * fica como estava (não se perde o "pago"); de resto calcula-se e começa por pagar.
 */
export const renewalFor = (
  form: PaidForm,
  existing: PaidService | null,
  today = new Date()
): { renewalDate: string; keepPaid: boolean } => {
  const cycle = form.kind === 'domain' ? 'yearly' : form.cycle;
  const unchanged =
    !!existing &&
    form.startDate === (existing.startDate ?? existing.renewalDate) &&
    cycle === existing.cycle;
  return unchanged
    ? { renewalDate: existing!.renewalDate, keepPaid: true }
    : { renewalDate: nextRenewalFrom(form.startDate, cycle, today), keepPaid: false };
};

/** "Todos os meses, no dia 5" / "De 3 em 3 meses" / "Todos os anos, a 5 de março". */
export const cycleSentence = (cycle: BillingCycle, startDate: string): string => {
  if (!startDate) return '';
  const start = parseISO(startDate);
  if (cycle === 'monthly') return `Todos os meses, no dia ${start.getDate()}`;
  if (cycle === 'quarterly') return 'De 3 em 3 meses';
  if (cycle === 'semiannual') return 'De 6 em 6 meses';
  return `Todos os anos, a ${format(start, "d 'de' MMMM", { locale: pt })}`;
};
