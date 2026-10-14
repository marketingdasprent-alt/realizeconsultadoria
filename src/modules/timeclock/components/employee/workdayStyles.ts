import type { Workday, WorkdayStatus } from '@/lib/workday';

/** Ponto colorido do estado: verde a trabalhar, âmbar em pausa, cinzento fora. */
export const WORKDAY_DOT_CLASSES: Record<WorkdayStatus, string> = {
  working: 'bg-green-500 animate-pulse',
  paused: 'bg-amber-500',
  closed: 'bg-slate-300 dark:bg-slate-600',
};

/** Texto curto do estado (relógio do cabeçalho). */
export const getWorkdayStatusText = (workday: Pick<Workday, 'status' | 'endedAt'>): string => {
  if (workday.status === 'working') return 'A trabalhar';
  if (workday.status === 'paused') return 'Em pausa';
  return workday.endedAt ? 'Dia terminado' : 'Iniciar dia';
};
