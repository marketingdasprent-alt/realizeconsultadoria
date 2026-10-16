// Calendário de ausências do admin: quem está fora em cada dia útil do mês e quantos dias
// aprovados soma cada colaborador. Datas em texto AAAA-MM-DD (comparação direta, sem fusos).
import { format, parseISO } from 'date-fns';
import { countBusinessDays, isBusinessDay, isWeekend, type Holiday } from '@/lib/vacation-utils';

export interface CalendarPeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string | null;
  period_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  business_days?: number | null;
}

export interface CalendarAbsence {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  absence_periods?: CalendarPeriod[] | null;
  employees: {
    name: string;
    company_id: string;
    companies: { name: string } | null;
  } | null;
}

export interface CalendarEmployee {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
}

export type EntryStatus = 'approved' | 'pending';

/** Uma pessoa fora num dia (a ausência mais forte, se tiver mais do que uma). */
export interface DayEntry {
  absenceId: string;
  employeeId: string;
  name: string;
  companyName: string;
  type: string;
  status: EntryStatus;
  /** Ausência de horas (ex.: 09:00–13:00). */
  partial: boolean;
  startTime: string | null;
  endTime: string | null;
  /** Período a que o dia pertence (AAAA-MM-DD). */
  periodStart: string;
  periodEnd: string;
}

const RANK: Record<EntryStatus, number> = { approved: 2, pending: 1 };

/** Aprovado ou pendente (o parcialmente aprovado conta como pendente); o resto não aparece. */
export const entryStatus = (raw: string | null | undefined): EntryStatus | null => {
  if (raw === 'approved') return 'approved';
  if (raw === 'pending' || raw === 'partially_approved') return 'pending';
  return null;
};

export const isoDay = (date: Date): string => format(date, 'yyyy-MM-dd');

export const holidayOn = (iso: string, holidays: Holiday[]): Holiday | undefined =>
  holidays.find(holiday => holiday.date === iso);

/**
 * Quem está fora num dia útil: um registo por colaborador (aprovado ganha a pendente) e por
 * ordem alfabética. Fins de semana e feriados ficam vazios; reprovados não contam.
 */
export const entriesForDay = (
  absences: CalendarAbsence[],
  day: Date,
  holidays: Holiday[]
): DayEntry[] => {
  const iso = isoDay(day);
  if (isWeekend(day) || holidayOn(iso, holidays)) return [];

  const best = new Map<string, DayEntry>();
  for (const absence of absences) {
    const periods = absence.absence_periods ?? [];
    const period =
      periods.length > 0
        ? periods.find(p => p.start_date <= iso && p.end_date >= iso)
        : absence.start_date <= iso && absence.end_date >= iso
          ? null
          : undefined;
    if (period === undefined) continue;

    const status = entryStatus(period?.status || absence.status);
    if (!status) continue;

    const current = best.get(absence.employee_id);
    if (current && RANK[current.status] >= RANK[status]) continue;
    best.set(absence.employee_id, {
      absenceId: absence.id,
      employeeId: absence.employee_id,
      name: absence.employees?.name ?? 'Colaborador',
      companyName: absence.employees?.companies?.name ?? '',
      type: absence.absence_type,
      status,
      partial: period?.period_type === 'partial',
      startTime: period?.start_time ?? null,
      endTime: period?.end_time ?? null,
      periodStart: period?.start_date ?? absence.start_date,
      periodEnd: period?.end_date ?? absence.end_date,
    });
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};

/**
 * Dias úteis aprovados de cada colaborador dentro do mês (por id), contando as ausências de
 * horas pelos dias já calculados no pedido.
 */
export const approvedDaysInMonth = (
  absences: CalendarAbsence[],
  monthStart: Date,
  monthEnd: Date,
  holidays: Holiday[]
): Map<string, number> => {
  const totals = new Map<string, number>();
  const add = (employeeId: string, days: number) =>
    days > 0 && totals.set(employeeId, (totals.get(employeeId) ?? 0) + days);

  for (const absence of absences) {
    const periods = absence.absence_periods ?? [];
    const segments =
      periods.length > 0
        ? periods.filter(p => (p.status || absence.status) === 'approved')
        : absence.status === 'approved'
          ? [{ start_date: absence.start_date, end_date: absence.end_date, period_type: null }]
          : [];

    for (const segment of segments) {
      const start = parseISO(segment.start_date);
      const end = parseISO(segment.end_date);
      if (segment.period_type === 'partial') {
        const inMonth = start >= monthStart && start <= monthEnd;
        const days = 'business_days' in segment ? Number(segment.business_days ?? 0) : 0;
        if (inMonth && isBusinessDay(start, holidays)) add(absence.employee_id, days);
        continue;
      }
      const from = start < monthStart ? monthStart : start;
      const to = end > monthEnd ? monthEnd : end;
      if (from <= to) add(absence.employee_id, countBusinessDays(from, to, holidays));
    }
  }
  return totals;
};

export interface TeamRow {
  employeeId: string;
  name: string;
  companyName: string;
  /** Um registo (ou nada) por dia do mês, alinhado com os dias. */
  cells: (DayEntry | null)[];
  approvedDays: number;
}

/**
 * Linhas do mapa da equipa: os colaboradores (ativos) e quem tiver ausências no mês,
 * só estes últimos se `onlyAbsent`.
 */
export const buildTeamRows = (
  employees: CalendarEmployee[],
  entriesByDay: DayEntry[][],
  approvedDays: Map<string, number>,
  onlyAbsent: boolean
): TeamRow[] => {
  const rows = new Map<string, TeamRow>();
  const ensure = (employeeId: string, name: string, companyName: string) => {
    let row = rows.get(employeeId);
    if (!row) {
      row = {
        employeeId,
        name,
        companyName,
        cells: entriesByDay.map(() => null),
        approvedDays: approvedDays.get(employeeId) ?? 0,
      };
      rows.set(employeeId, row);
    }
    return row;
  };

  entriesByDay.forEach((entries, dayIndex) => {
    for (const entry of entries) {
      ensure(entry.employeeId, entry.name, entry.companyName).cells[dayIndex] = entry;
    }
  });
  if (!onlyAbsent) {
    for (const employee of employees) ensure(employee.id, employee.name, employee.companyName);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};

/** "10" ou "0,5" (dias). */
export const formatDays = (days: number): string =>
  days % 1 === 0 ? String(days) : days.toFixed(2).replace(/0$/, '').replace('.', ',');
