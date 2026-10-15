import { Pause, Play, Power, type LucideIcon } from 'lucide-react';
import type { Workday, WorkdayAction, WorkdayStatus } from '@/lib/workday';

/** Ponto colorido do estado: verde a trabalhar, âmbar em pausa, cinzento fora. */
export const WORKDAY_DOT_CLASSES: Record<WorkdayStatus, string> = {
  working: 'bg-green-500 animate-pulse',
  paused: 'bg-amber-500',
  closed: 'bg-slate-300 dark:bg-slate-600',
};

/** Ícone de cada ação (botões e lista do dia), como no Bitrix24. */
export const ACTION_ICONS: Record<WorkdayAction, LucideIcon> = {
  start: Play,
  pause: Pause,
  resume: Play,
  stop: Power,
};

/** Bolha colorida de cada registo na lista do dia. */
export const ACTION_BUBBLE_CLASSES: Record<WorkdayAction, string> = {
  start: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  resume: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  pause: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  stop: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** Texto curto do estado (relógio do cabeçalho). */
export const getWorkdayStatusText = (workday: Pick<Workday, 'status' | 'endedAt'>): string => {
  if (workday.status === 'working') return 'A trabalhar';
  if (workday.status === 'paused') return 'Em pausa';
  return workday.endedAt ? 'Dia terminado' : 'Iniciar dia';
};
