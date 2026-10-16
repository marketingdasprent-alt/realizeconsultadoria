// Horário de trabalho de cada pessoa (para os lembretes de ponto).
import { supabase } from '@/integrations/supabase/client';

export interface WorkSchedule {
  reminders: boolean;
  /** Dias da semana (1 = segunda … 7 = domingo). */
  days: number[];
  startTime: string;
  endTime: string;
  lunchStart: string | null;
  lunchEnd: string | null;
  toleranceMin: number;
}

export const DEFAULT_SCHEDULE: WorkSchedule = {
  reminders: true,
  days: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  toleranceMin: 10,
};

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);

/** Problema do horário (para mostrar antes de gravar) ou null se estiver bem. */
export const scheduleProblem = (s: WorkSchedule): string | null => {
  if (!s.days.length) return 'Escolha pelo menos um dia.';
  if (s.endTime <= s.startTime) return 'A saída tem de ser depois da entrada.';
  if (s.lunchStart && s.lunchEnd) {
    if (s.lunchStart <= s.startTime || s.lunchEnd >= s.endTime)
      return 'O almoço tem de ficar entre a entrada e a saída.';
    if (s.lunchEnd <= s.lunchStart) return 'O fim do almoço tem de ser depois do início.';
  }
  return null;
};

export const scheduleService = {
  get: async (userId: string): Promise<WorkSchedule | null> => {
    const { data } = await supabase
      .from('work_schedules')
      .select('reminders, days, start_time, end_time, lunch_start, lunch_end, tolerance_min')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      reminders: data.reminders,
      days: data.days ?? [],
      startTime: hhmm(data.start_time) ?? DEFAULT_SCHEDULE.startTime,
      endTime: hhmm(data.end_time) ?? DEFAULT_SCHEDULE.endTime,
      lunchStart: hhmm(data.lunch_start),
      lunchEnd: hhmm(data.lunch_end),
      toleranceMin: data.tolerance_min,
    };
  },

  save: async (userId: string, s: WorkSchedule) => {
    const { error } = await supabase.from('work_schedules').upsert(
      {
        user_id: userId,
        reminders: s.reminders,
        days: s.days,
        start_time: s.startTime,
        end_time: s.endTime,
        lunch_start: s.lunchStart,
        lunch_end: s.lunchEnd,
        tolerance_min: s.toleranceMin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    return { error };
  },
};
