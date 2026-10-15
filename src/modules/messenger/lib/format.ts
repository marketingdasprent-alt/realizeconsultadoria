import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Hash, Home, Megaphone, Sparkles, User, Users, type LucideIcon } from 'lucide-react';
import type { ConversationFilter } from '../types';

/** Hora na lista de conversas: hoje → 14:05, ontem → Ontem, esta semana → qua, senão 03/10. */
export const formatListTime = (iso: string, now: Date = new Date()): string => {
  const date = new Date(iso);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  if (differenceInCalendarDays(now, date) < 7) return format(date, 'EEE', { locale: pt });
  return format(date, 'dd/MM');
};

/** Separador de dia dentro da conversa. */
export const formatDayDivider = (iso: string): string => {
  const date = new Date(iso);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "EEEE, d 'de' MMMM", { locale: pt });
};

export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

export interface FilterOption {
  key: ConversationFilter;
  label: string;
  icon: LucideIcon;
  tint: string;
}

/** Coluna de filtros do Messenger (tipos de comunicação do briefing §5). */
export const FILTERS: FilterOption[] = [
  { key: 'all', label: 'Todas', icon: Home, tint: 'from-violet-500 to-indigo-500' },
  { key: 'direct', label: 'Privadas', icon: User, tint: 'from-sky-400 to-blue-600' },
  { key: 'group', label: 'Grupos', icon: Users, tint: 'from-emerald-400 to-teal-500' },
  { key: 'channel', label: 'Canais', icon: Hash, tint: 'from-orange-400 to-rose-500' },
  { key: 'announcement', label: 'Anúncios', icon: Megaphone, tint: 'from-amber-400 to-orange-500' },
  {
    key: 'ai',
    label: 'Realize AI',
    icon: Sparkles,
    tint: 'from-violet-500 via-fuchsia-500 to-amber-400',
  },
];
