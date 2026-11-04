// Banco de horas: horas feitas + ausências justificadas − horas previstas, dia a dia, no mês.
import { eachDayOfInterval, endOfMonth, format, getISODay, parseISO, startOfMonth } from 'date-fns';

export type AbsenceRule = 'justified' | 'compensate';

export interface HourBankSettings {
  /** Horas previstas por dia de trabalho, em minutos (480 = 8h). */
  dailyMinutes: number;
  /** Dias de trabalho (1 = segunda … 7 = domingo). */
  workdays: number[];
  /** Por tipo de ausência; tipo sem regra = justificada. */
  absenceRules: Record<string, AbsenceRule>;
  /** Primeiro dia que conta (yyyy-MM-dd); antes disso o ponto não era usado todos os dias. */
  startsOn: string | null;
}

export const DEFAULT_HOUR_BANK: HourBankSettings = {
  dailyMinutes: 480,
  workdays: [1, 2, 3, 4, 5],
  absenceRules: {},
  startsOn: null,
};

export interface BankAbsencePeriod {
  start_date: string;
  end_date: string;
  status?: string | null;
  period_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface BankAbsence {
  employee_id: string;
  absence_type: string;
  status: string;
  start_date: string;
  end_date: string;
  absence_periods?: BankAbsencePeriod[] | null;
}

export interface BankDay {
  date: string;
  /** Previsto (0 ao fim de semana e nos feriados). */
  expected: number;
  worked: number;
  /** Ausência aprovada que conta como trabalho (regra "justificada"). */
  justified: number;
  /** Ausência aprovada que tem de ser compensada (não abate ao previsto). */
  toCompensate: number;
  balance: number;
  absenceType: string | null;
  holiday: string | null;
}

export interface MonthBank {
  days: BankDay[];
  expected: number;
  worked: number;
  justified: number;
  balance: number;
}

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Segmentos aprovados de uma ausência (só os períodos aprovados, se os houver). */
const approvedPeriods = (absence: BankAbsence): BankAbsencePeriod[] => {
  const periods = absence.absence_periods ?? [];
  if (periods.length) return periods.filter(p => (p.status || absence.status) === 'approved');
  return absence.status === 'approved'
    ? [{ start_date: absence.start_date, end_date: absence.end_date, period_type: 'full_day' }]
    : [];
};

/**
 * Saldo do mês de uma pessoa. Conta só até `today` exclusive (o dia em curso ainda não fechou);
 * `workedByDay` = minutos trabalhados por dia (yyyy-MM-dd).
 */
export const monthHourBank = (params: {
  month: Date;
  today: Date;
  workedByDay: Map<string, number>;
  absences: BankAbsence[];
  holidays: { date: string; name: string }[];
  settings: HourBankSettings;
}): MonthBank => {
  const { settings } = params;
  const todayKey = format(params.today, 'yyyy-MM-dd');
  const holidays = new Map(params.holidays.map(h => [h.date, h.name]));
  const periods = params.absences.flatMap(a =>
    approvedPeriods(a).map(p => ({ ...p, type: a.absence_type }))
  );

  const days: BankDay[] = [];
  for (const day of eachDayOfInterval({
    start: startOfMonth(params.month),
    end: endOfMonth(params.month),
  })) {
    const date = format(day, 'yyyy-MM-dd');
    if (date >= todayKey) break;
    if (settings.startsOn && date < settings.startsOn) continue;
    const holiday = holidays.get(date) ?? null;
    const expected =
      !holiday && settings.workdays.includes(getISODay(day)) ? settings.dailyMinutes : 0;
    const worked = params.workedByDay.get(date) ?? 0;

    let absent = 0;
    let justified = 0;
    let absenceType: string | null = null;
    for (const p of periods) {
      if (date < p.start_date || date > p.end_date) continue;
      absenceType ??= p.type;
      const minutes =
        p.period_type === 'partial' && p.start_time && p.end_time
          ? Math.max(0, minutesOf(p.end_time) - minutesOf(p.start_time))
          : expected;
      absent += minutes;
      if ((settings.absenceRules[p.type] ?? 'justified') === 'justified') justified += minutes;
    }
    // A ausência nunca vale mais do que o dia previsto.
    justified = Math.min(justified, expected);
    const toCompensate = Math.max(0, Math.min(absent, expected) - justified);

    if (!expected && !worked) continue;
    days.push({
      date,
      expected,
      worked,
      justified,
      toCompensate,
      balance: worked + justified - expected,
      absenceType,
      holiday,
    });
  }

  const sum = (key: 'expected' | 'worked' | 'justified' | 'balance') =>
    days.reduce((total, d) => total + d[key], 0);
  return {
    days,
    expected: sum('expected'),
    worked: sum('worked'),
    justified: sum('justified'),
    balance: sum('balance'),
  };
};

/** "+1h20", "−0h45", "0h00". */
export const formatBalance = (minutes: number): string => {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : '';
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
};

/** Regras da BD (jsonb) → só os valores conhecidos. */
export const parseAbsenceRules = (value: unknown): Record<string, AbsenceRule> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, AbsenceRule] =>
        entry[1] === 'justified' || entry[1] === 'compensate'
    )
  );
};

/** Dia (yyyy-MM-dd) como data local ao meio-dia (evita saltos de fuso). */
export const bankDayDate = (date: string) => parseISO(`${date}T12:00:00`);
