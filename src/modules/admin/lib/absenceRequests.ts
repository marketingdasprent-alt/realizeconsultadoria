// Pedidos de ausência no admin (Férias e Ausências → Pedidos): tipos, filtros, ordem e textos
// curtos das linhas. Sem React nem Supabase, para se testar à parte.
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { matchesSearch } from '@/lib/utils';

export interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status?: string;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
}

export interface AbsenceRequest {
  id: string;
  status: string;
  absence_type: string;
  training_mode: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  start_date: string;
  end_date: string;
  employee_id: string;
  total_business_days: number;
  document_count: number;
  approved_by: string | null;
  approver_name: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    user_id: string | null;
    position: string | null;
    department: string | null;
  };
  company: { id: string; name: string };
  periods: AbsencePeriod[];
}

export type RequestStatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export const STATUS_FILTERS: { value: RequestStatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
  { value: 'all', label: 'Todos' },
];

export const toStatusFilter = (value: string | null): RequestStatusFilter =>
  STATUS_FILTERS.find(option => option.value === value)?.value ?? 'pending';

export interface RequestFilters {
  status: RequestStatusFilter;
  search: string;
  type: string;
  companyId: string;
}

export const isApprovedStatus = (status: string) =>
  status === 'approved' || status === 'partially_approved';

const matchesStatus = (request: AbsenceRequest, status: RequestStatusFilter) =>
  status === 'all' ||
  (status === 'approved' ? isApprovedStatus(request.status) : request.status === status);

const matchesOthers = (request: AbsenceRequest, filters: RequestFilters) =>
  (filters.type === 'all' || request.absence_type === filters.type) &&
  (filters.companyId === 'all' || request.company.id === filters.companyId) &&
  matchesSearch(request.employee.name, filters.search);

/**
 * Por aprovar primeiro, os que começam mais cedo à frente (os mais urgentes); depois os
 * restantes, do pedido mais recente para o mais antigo.
 */
export const sortRequests = (requests: AbsenceRequest[]): AbsenceRequest[] =>
  [...requests].sort((a, b) => {
    const aPending = a.status === 'pending';
    const bPending = b.status === 'pending';
    if (aPending !== bPending) return aPending ? -1 : 1;
    if (aPending) return a.start_date.localeCompare(b.start_date);
    return b.created_at.localeCompare(a.created_at);
  });

export const filterRequests = (requests: AbsenceRequest[], filters: RequestFilters) =>
  sortRequests(
    requests.filter(
      request => matchesStatus(request, filters.status) && matchesOthers(request, filters)
    )
  );

/** Números de cada estado com a pesquisa, o tipo e a empresa aplicados (não o estado). */
export const statusCounts = (
  requests: AbsenceRequest[],
  filters: RequestFilters
): Record<RequestStatusFilter, number> => {
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const request of requests) {
    if (!matchesOthers(request, filters)) continue;
    counts.all += 1;
    if (request.status === 'pending') counts.pending += 1;
    else if (isApprovedStatus(request.status)) counts.approved += 1;
    else if (request.status === 'rejected') counts.rejected += 1;
  }
  return counts;
};

/** Horas de trabalho entre duas horas, sem a hora de almoço (13:00–14:00). */
export const workingHours = (startTime: string, endTime: string): number => {
  const minutes = (time: string) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  const start = minutes(startTime);
  const end = minutes(endTime);
  const lunch = Math.max(0, Math.min(end, 14 * 60) - Math.max(start, 13 * 60));
  return Math.max(0, end - start - lunch) / 60;
};

/** 1 → "1"; 0.5 → "0,5"; 1.25 → "1,25". */
export const formatAmount = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');

const isPartial = (period: AbsencePeriod) =>
  period.period_type === 'partial' && !!period.start_time && !!period.end_time;

/** "1 dia", "2,5 dias" ou "3h" (horas quando todos os períodos são de horas). */
export const requestDuration = (
  request: Pick<AbsenceRequest, 'periods' | 'total_business_days'>
) => {
  const { periods } = request;
  if (periods.length > 0 && periods.every(isPartial)) {
    const hours = periods.reduce(
      (sum, period) => sum + workingHours(period.start_time!, period.end_time!),
      0
    );
    return `${formatAmount(hours)}h`;
  }
  const days = request.total_business_days;
  return `${formatAmount(days)} ${days === 1 ? 'dia' : 'dias'}`;
};

/** "09:00–13:00 · 4h" ou "3 dias úteis". */
export const periodDuration = (period: AbsencePeriod): string => {
  if (isPartial(period)) {
    const hours = workingHours(period.start_time!, period.end_time!);
    return `${period.start_time!.slice(0, 5)}–${period.end_time!.slice(0, 5)} · ${formatAmount(hours)}h`;
  }
  const days = Number(period.business_days);
  return `${formatAmount(days)} ${days === 1 ? 'dia útil' : 'dias úteis'}`;
};

/** Primeiro e último dia do pedido (pelos períodos; sem períodos, as datas do pedido). */
export const requestSpan = (
  request: Pick<AbsenceRequest, 'periods' | 'start_date' | 'end_date'>
) => {
  if (request.periods.length === 0) return { start: request.start_date, end: request.end_date };
  const starts = request.periods.map(period => period.start_date).sort();
  const ends = request.periods.map(period => period.end_date).sort();
  return { start: starts[0], end: ends[ends.length - 1] };
};

/** "14 out", "14–18 out", "28 out – 3 nov"; o ano só quando não é o atual. */
export const dateRange = (start: string, end: string, now = new Date()): string => {
  const from = parseISO(start);
  const to = parseISO(end);
  const dayMonth = (date: Date) => format(date, 'd MMM', { locale: pt });
  const sameYear = from.getFullYear() === to.getFullYear();
  const year = (date: Date, force = false) =>
    force || date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';
  if (start === end) return `${dayMonth(from)}${year(from)}`;
  if (sameYear && from.getMonth() === to.getMonth())
    return `${from.getDate()}–${dayMonth(to)}${year(to)}`;
  if (sameYear) return `${dayMonth(from)} – ${dayMonth(to)}${year(to)}`;
  return `${dayMonth(from)}${year(from, true)} – ${dayMonth(to)}${year(to, true)}`;
};

/** Quando foi feito o pedido: "hoje", "ontem", "há 3 dias" ou a data. */
export const requestedAgo = (createdAt: string, now = new Date()): string => {
  const days = differenceInCalendarDays(now, parseISO(createdAt));
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return format(parseISO(createdAt), 'd MMM yyyy', { locale: pt });
};

export type Urgency = { label: string; tone: 'late' | 'soon' } | null;

/** Pedido por aprovar que já passou, já começou ou começa nos próximos 7 dias. */
export const startUrgency = (start: string, end: string, now = new Date()): Urgency => {
  const days = differenceInCalendarDays(parseISO(start), now);
  if (differenceInCalendarDays(parseISO(end), now) < 0) return { label: 'Já passou', tone: 'late' };
  if (days < 0) return { label: 'Já começou', tone: 'late' };
  if (days === 0) return { label: 'Começa hoje', tone: 'soon' };
  if (days === 1) return { label: 'Amanhã', tone: 'soon' };
  if (days <= 7) return { label: `Em ${days} dias`, tone: 'soon' };
  return null;
};

/** Ausência de um colega que coincide com o pedido. */
export interface Overlap {
  name: string;
  absenceType: string;
  start: string;
  end: string;
  pending: boolean;
}

export interface PersonOverlap {
  name: string;
  pending: boolean;
  items: Overlap[];
}

/**
 * Colegas fora em algum dos dias pedidos (não basta cair entre o primeiro e o último dia),
 * um por pessoa, pela ordem em que saem.
 */
export const groupOverlaps = (
  overlaps: Overlap[],
  periods: Pick<AbsencePeriod, 'start_date' | 'end_date'>[]
): PersonOverlap[] => {
  const people = new Map<string, PersonOverlap>();
  for (const item of overlaps) {
    const hits = periods.some(
      period => item.start <= period.end_date && item.end >= period.start_date
    );
    if (!hits) continue;
    const person = people.get(item.name) ?? { name: item.name, pending: true, items: [] };
    person.items.push(item);
    person.pending = person.pending && item.pending;
    people.set(item.name, person);
  }
  return [...people.values()];
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  partially_approved: 'Aprovado em parte',
  rejected: 'Rejeitado',
};
