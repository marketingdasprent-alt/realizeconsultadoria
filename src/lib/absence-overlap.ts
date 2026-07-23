import { supabase } from '@/integrations/supabase/client';
import { absenceTypeLabels } from '@/lib/absence-types';

/**
 * Deteção de sobreposição entre ausências do mesmo colaborador.
 *
 * Regra do negócio: o mesmo colaborador não pode ter dois pedidos aprovados a
 * ocupar o mesmo dia. Dois períodos parciais no mesmo dia são permitidos desde
 * que as horas não colidam (ex.: formação 09:00-13:00 + consulta 16:00-17:00).
 */

/** Estados que já ocupam o calendário e o saldo do colaborador. */
const OCCUPYING_ABSENCE_STATUSES = ['approved', 'partially_approved'];

export interface OverlapPeriod {
  /** yyyy-MM-dd */
  start_date: string;
  /** yyyy-MM-dd */
  end_date: string;
  period_type?: string | null;
  /** HH:MM ou HH:MM:SS */
  start_time?: string | null;
  end_time?: string | null;
}

export interface AbsenceConflict {
  absenceId: string;
  absenceType: string;
  /** Primeiro dia em conflito (yyyy-MM-dd) */
  date: string;
  startTime: string | null;
  endTime: string | null;
}

/** "16:00" ou "16:00:00" → minutos desde a meia-noite. */
const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Um período só é parcial se tiver mesmo as duas horas preenchidas. */
const isPartial = (p: OverlapPeriod): boolean =>
  p.period_type === 'partial' && !!p.start_time && !!p.end_time;

/** Primeiro dia comum a dois períodos, ou null se não se cruzarem. */
const firstSharedDay = (a: OverlapPeriod, b: OverlapPeriod): string | null => {
  const start = a.start_date > b.start_date ? a.start_date : b.start_date;
  const end = a.end_date < b.end_date ? a.end_date : b.end_date;
  return start <= end ? start : null;
};

/**
 * Dois períodos colidem quando partilham um dia de calendário e as horas se
 * sobrepõem. Um período de dia inteiro colide com tudo o que caia nesse dia.
 */
export const periodsConflict = (a: OverlapPeriod, b: OverlapPeriod): boolean => {
  if (!firstSharedDay(a, b)) return false;

  // Basta um deles ser dia inteiro para ocupar o dia todo.
  if (!isPartial(a) || !isPartial(b)) return true;

  // Ambos parciais: só colidem se as horas se cruzarem.
  const aStart = toMinutes(a.start_time as string);
  const aEnd = toMinutes(a.end_time as string);
  const bStart = toMinutes(b.start_time as string);
  const bEnd = toMinutes(b.end_time as string);

  return aStart < bEnd && bStart < aEnd;
};

/** Colisões entre os períodos de um mesmo pedido (ex.: o utilizador repetiu um dia). */
export const findSelfConflicts = (periods: OverlapPeriod[]): [number, number] | null => {
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      if (periodsConflict(periods[i], periods[j])) return [i, j];
    }
  }
  return null;
};

/**
 * Procura ausências já aprovadas do colaborador que colidam com os períodos
 * indicados. Segue o padrão dos serviços: nunca lança, devolve { data, error }.
 *
 * @param excludeAbsenceId Ausência a ignorar (ao editar/aprovar a própria).
 */
export const findApprovedConflicts = async (
  employeeId: string,
  periods: OverlapPeriod[],
  excludeAbsenceId?: string
): Promise<{ data: AbsenceConflict[] | null; error: unknown }> => {
  try {
    if (periods.length === 0) return { data: [], error: null };

    const rangeStart = periods.reduce(
      (min, p) => (p.start_date < min ? p.start_date : min),
      periods[0].start_date
    );
    const rangeEnd = periods.reduce(
      (max, p) => (p.end_date > max ? p.end_date : max),
      periods[0].end_date
    );

    let query = supabase
      .from('absences')
      .select('id, absence_type, start_date, end_date, status, absence_periods(*)')
      .eq('employee_id', employeeId)
      .in('status', OCCUPYING_ABSENCE_STATUSES)
      .lte('start_date', rangeEnd)
      .gte('end_date', rangeStart);

    if (excludeAbsenceId) query = query.neq('id', excludeAbsenceId);

    const { data, error } = await query;
    if (error) throw error;

    const conflicts: AbsenceConflict[] = [];

    for (const absence of data || []) {
      // Num pedido parcialmente aprovado só os períodos aprovados ocupam o dia.
      const existingPeriods: OverlapPeriod[] =
        absence.absence_periods && absence.absence_periods.length > 0
          ? absence.absence_periods.filter(
              (p: { status?: string | null }) => (p.status || absence.status) === 'approved'
            )
          : [
              {
                start_date: absence.start_date,
                end_date: absence.end_date,
                period_type: 'full_day',
              },
            ];

      for (const existing of existingPeriods) {
        const hit = periods.find(candidate => periodsConflict(candidate, existing));
        if (!hit) continue;

        conflicts.push({
          absenceId: absence.id,
          absenceType: absence.absence_type,
          date: firstSharedDay(hit, existing) as string,
          startTime: isPartial(existing) ? (existing.start_time as string) : null,
          endTime: isPartial(existing) ? (existing.end_time as string) : null,
        });
        break; // um conflito por ausência chega para avisar
      }
    }

    return { data: conflicts, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/** Mensagem pronta a mostrar num toast. */
export const describeConflicts = (conflicts: AbsenceConflict[]): string => {
  const parts = conflicts.slice(0, 3).map(c => {
    const label = absenceTypeLabels[c.absenceType] || c.absenceType;
    const [y, m, d] = c.date.split('-');
    const when = `${d}/${m}/${y}`;
    return c.startTime ? `${when} (${label}, ${c.startTime}-${c.endTime})` : `${when} (${label})`;
  });

  const extra = conflicts.length > 3 ? ` e mais ${conflicts.length - 3}` : '';
  return `Já existe uma ausência aprovada em ${parts.join(', ')}${extra}.`;
};
