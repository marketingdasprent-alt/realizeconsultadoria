import type { LabelColor } from '../types';

/** Cores dos marcadores (classes Tailwind escritas por extenso para o build as encontrar). */
export const LABEL_STYLES: Record<LabelColor, { dot: string; chip: string; label: string }> = {
  red: { dot: 'bg-red-500', chip: 'bg-red-100 text-red-700', label: 'Vermelho' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', label: 'Laranja' },
  amber: { dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700', label: 'Amarelo' },
  green: { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700', label: 'Verde' },
  teal: { dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-700', label: 'Turquesa' },
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700', label: 'Azul' },
  purple: { dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700', label: 'Roxo' },
  pink: { dot: 'bg-pink-500', chip: 'bg-pink-100 text-pink-700', label: 'Rosa' },
  gray: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700', label: 'Cinzento' },
};

export const labelStyle = (color: string) => LABEL_STYLES[color as LabelColor] ?? LABEL_STYLES.gray;
