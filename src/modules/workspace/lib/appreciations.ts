// Tipos de apreciação (briefing §7). A gravação (quem envia, quem recebe, mensagem,
// visibilidade) chega com o módulo de Apreciações.
import {
  BadgeCheck,
  Crown,
  Flame,
  HandHeart,
  Heart,
  Lightbulb,
  PartyPopper,
  Rocket,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AppreciationType {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
}

export const APPRECIATION_TYPES: AppreciationType[] = [
  {
    key: 'great_work',
    label: 'Excelente trabalho',
    icon: Trophy,
    tint: 'from-amber-400 to-orange-500',
  },
  {
    key: 'team_spirit',
    label: 'Espírito de equipa',
    icon: Users,
    tint: 'from-sky-400 to-blue-600',
  },
  {
    key: 'creativity',
    label: 'Criatividade',
    icon: Lightbulb,
    tint: 'from-yellow-300 to-amber-500',
  },
  { key: 'leadership', label: 'Liderança', icon: Crown, tint: 'from-violet-500 to-indigo-600' },
  {
    key: 'helpful',
    label: 'Ajuda importante',
    icon: HandHeart,
    tint: 'from-emerald-400 to-teal-600',
  },
  {
    key: 'professional',
    label: 'Profissionalismo',
    icon: BadgeCheck,
    tint: 'from-cyan-400 to-sky-600',
  },
  { key: 'innovation', label: 'Inovação', icon: Rocket, tint: 'from-fuchsia-400 to-purple-600' },
  { key: 'dedication', label: 'Dedicação', icon: Flame, tint: 'from-orange-400 to-rose-500' },
  { key: 'congrats', label: 'Parabéns', icon: PartyPopper, tint: 'from-pink-400 to-rose-500' },
  { key: 'thanks', label: 'Obrigado', icon: Heart, tint: 'from-rose-400 to-red-500' },
];
