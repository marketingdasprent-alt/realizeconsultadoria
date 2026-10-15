// Ícone e cor de cada tipo de ausência (os nomes continuam em @/lib/absence-types).
import {
  Baby,
  CircleEllipsis,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export const ABSENCE_TYPE_STYLES: Record<string, { icon: LucideIcon; tint: string }> = {
  vacation: { icon: Palmtree, tint: 'from-lime-400 to-green-600' },
  sick_leave: { icon: HeartPulse, tint: 'from-rose-400 to-red-500' },
  appointment: { icon: Stethoscope, tint: 'from-sky-400 to-blue-600' },
  personal_leave: { icon: UserRound, tint: 'from-violet-500 to-indigo-600' },
  maternity: { icon: Baby, tint: 'from-pink-400 to-rose-500' },
  paternity: { icon: Baby, tint: 'from-cyan-400 to-sky-600' },
  training: { icon: GraduationCap, tint: 'from-amber-400 to-orange-500' },
  other: { icon: CircleEllipsis, tint: 'from-slate-400 to-slate-600' },
};

export const absenceTypeStyle = (type: string) =>
  ABSENCE_TYPE_STYLES[type] ?? ABSENCE_TYPE_STYLES.other;

/** Cores das etiquetas de estado. */
export const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
  partially_approved: 'bg-sky-100 text-sky-800',
};
