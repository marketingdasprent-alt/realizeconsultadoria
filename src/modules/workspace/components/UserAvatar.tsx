import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAvatarUrl } from '../hooks/useAvatarUrl';

const GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-blue-600',
];

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-28 w-28 text-3xl',
};

const STATUS_CLASSES = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-slate-300',
};

export type AvatarStatus = keyof typeof STATUS_CLASSES;

/** Iniciais (primeiro e último nome). */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
};

/** Cor estável por pessoa (o mesmo nome dá sempre o mesmo gradiente). */
const pickGradient = (seed: string): string => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
};

interface UserAvatarProps {
  name: string;
  /** Pessoa (procura a fotografia no diretório da empresa). */
  userId?: string | null;
  /** Fotografia já conhecida (ex.: pré-visualização ao escolher uma nova). */
  src?: string | null;
  size?: keyof typeof SIZES;
  status?: AvatarStatus;
  className?: string;
}

/** Fotografia da pessoa ou, sem ela, as iniciais sobre um gradiente. */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  userId,
  src,
  size = 'sm',
  status,
  className,
}) => {
  const fromDirectory = useAvatarUrl(src ? null : userId);
  const photo = src ?? fromDirectory;
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = !!photo && broken !== photo;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/70',
          SIZES[size],
          pickGradient(name)
        )}
        aria-hidden
      >
        {showPhoto ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setBroken(photo)}
            className="h-full w-full object-cover"
          />
        ) : (
          getInitials(name)
        )}
      </span>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white',
            size === 'xl' && 'bottom-2 right-2 h-5 w-5 ring-4',
            STATUS_CLASSES[status]
          )}
          aria-label={
            status === 'online' ? 'Disponível' : status === 'away' ? 'Ausente' : 'Offline'
          }
        />
      )}
    </span>
  );
};
