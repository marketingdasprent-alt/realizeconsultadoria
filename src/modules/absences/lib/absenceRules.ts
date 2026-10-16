// Regras dos pedidos de férias e ausências do colaborador (as mesmas da página antiga,
// agora isoladas e testadas). A BD repete as regras críticas em triggers e RPCs.
import { addDays, format, startOfDay } from 'date-fns';
import { countBusinessDays, type DatePeriod, type Holiday } from '@/lib/vacation-utils';

export type RequestFilter = 'all' | 'pending' | 'upcoming' | 'past';

export const REQUEST_FILTERS: { value: RequestFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Passados' },
];

export type AbsenceStatus = 'pending' | 'approved' | 'rejected' | 'partially_approved';

export const ABSENCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  partially_approved: 'Parcialmente aprovado',
};

export interface AbsencePeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status: string;
  period_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface AbsenceRow {
  id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  notes: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  training_mode?: string | null;
  absence_periods?: AbsencePeriodRow[];
  document_count?: number;
}

export interface VacationBalance {
  total_days: number;
  used_days: number;
  self_schedulable_days: number | null;
}

/** Pendentes; próximos (acabam hoje ou depois e não rejeitados); passados (já acabaram). */
export const filterAbsences = (
  absences: AbsenceRow[],
  filter: RequestFilter,
  today: string = format(new Date(), 'yyyy-MM-dd')
): AbsenceRow[] =>
  absences.filter(absence => {
    if (filter === 'pending') return absence.status === 'pending';
    if (filter === 'upcoming') return absence.end_date >= today && absence.status !== 'rejected';
    if (filter === 'past') return absence.end_date < today;
    return true;
  });

/** Primeiro e último dia de um conjunto de períodos. */
export const periodsRange = (periods: DatePeriod[]): { from: Date; to: Date } => {
  const times = periods.flatMap(p => [p.from.getTime(), p.to.getTime()]);
  return { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) };
};

/**
 * Antecedência de 48 h — só para férias. Os outros tipos (baixa, consulta, licença…) são
 * imprevisíveis e podem ser pedidos no próprio dia.
 */
export const violatesVacationNotice = (
  absenceType: string,
  firstDay: Date,
  now: Date = new Date()
): boolean => absenceType === 'vacation' && firstDay < addDays(startOfDay(now), 2);

/** Linhas de absence_periods: dias úteis calculados (parciais: horas ÷ 8, já calculado). */
export const toPeriodRows = (periods: DatePeriod[], holidays: Holiday[]) =>
  periods.map(period => ({
    start_date: format(period.from, 'yyyy-MM-dd'),
    end_date: format(period.to, 'yyyy-MM-dd'),
    business_days:
      period.periodType === 'partial' && period.businessDays !== undefined
        ? period.businessDays
        : countBusinessDays(period.from, period.to, holidays),
    period_type: period.periodType,
    start_time: period.startTime || null,
    end_time: period.endTime || null,
  }));

/**
 * Máximo de dias de férias que o colaborador pode marcar: o que resta da quota própria
 * (se a empresa reservou dias) ou o saldo disponível. Só avisa; não bloqueia.
 */
export const maxVacationDays = (
  balance: VacationBalance | null,
  scheduledByEmployee: number
): number | undefined => {
  if (!balance) return undefined;
  if (balance.self_schedulable_days !== null) {
    return Math.max(0, balance.self_schedulable_days - scheduledByEmployee);
  }
  return balance.total_days - balance.used_days;
};

export interface BalanceSummary {
  available: number;
  used: number;
  pending: number;
  total: number;
  /** Quota que o colaborador pode marcar sozinho (null = sem limite). */
  selfSchedulable: number | null;
  remainingSelf: number | null;
  /** Dias reservados pela empresa (o excedente da quota própria come desta reserva). */
  companyReserved: number;
}

export const summarizeBalance = (
  balance: VacationBalance,
  scheduledByEmployee: number,
  pendingDays: number
): BalanceSummary => {
  const hasLimit = balance.self_schedulable_days !== null;
  const selfQuota = balance.self_schedulable_days ?? 0;
  return {
    available: balance.total_days - balance.used_days,
    used: balance.used_days,
    pending: pendingDays,
    total: balance.total_days,
    selfSchedulable: hasLimit ? selfQuota : null,
    remainingSelf: hasLimit ? Math.max(0, selfQuota - scheduledByEmployee) : null,
    companyReserved: hasLimit
      ? Math.max(0, balance.total_days - Math.max(scheduledByEmployee, selfQuota))
      : 0,
  };
};

/** Férias futuras: as aprovadas remarcam-se; as pendentes editam-se até alguém decidir. */
export const canReschedule = (absence: AbsenceRow, now: Date = new Date()): boolean =>
  (absence.status === 'approved' || absence.status === 'pending') &&
  absence.absence_type === 'vacation' &&
  new Date(`${absence.start_date}T00:00:00`) > now;

/** Só se cancelam pedidos pendentes ou rejeitados. */
export const canCancel = (absence: AbsenceRow): boolean =>
  absence.status === 'pending' || absence.status === 'rejected';

/** 1 → "1", 1.5 → "1.5" (saldo). */
export const formatDays = (days: number): string =>
  days % 1 === 0 ? days.toString() : days.toFixed(1);

/** Dias de um período: "1 dia", "5 dias", "0.25 dias". */
export const formatPeriodDays = (days: number): string => {
  const value = Number(days);
  if (value % 1 !== 0) return `${value.toFixed(2)} dias`;
  return `${value} ${value === 1 ? 'dia' : 'dias'}`;
};

/**
 * Dias escolhidos no calendário (yyyy-MM-dd) → períodos de dia completo, juntando os dias
 * seguidos (fins de semana e feriados no meio não partem o período: não contam como úteis).
 */
export const daysToPeriods = (days: string[]): DatePeriod[] => {
  const sorted = [...new Set(days)].sort();
  const periods: DatePeriod[] = [];
  for (const iso of sorted) {
    const day = new Date(`${iso}T00:00:00`);
    const last = periods[periods.length - 1];
    if (last && addDays(last.to, 1).getTime() === day.getTime()) last.to = day;
    else periods.push({ from: day, to: day, periodType: 'full_day' });
  }
  return periods;
};
