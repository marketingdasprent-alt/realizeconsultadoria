import React from 'react';
import { cn } from '@/lib/utils';
import type { WorkspaceModule } from '../lib/navigation';

const SIZES = {
  xs: 'h-6 w-6 rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5',
  sm: 'h-8 w-8 rounded-[10px] [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5',
  lg: 'h-16 w-16 rounded-2xl [&>svg]:h-8 [&>svg]:w-8',
  xl: 'h-20 w-20 rounded-[26px] [&>svg]:h-10 [&>svg]:w-10',
};

interface ModuleIconProps {
  module: Pick<WorkspaceModule, 'icon' | 'tint'>;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Mosaico colorido do módulo (gradiente próprio + brilho suave), como num launcher. */
export const ModuleIcon: React.FC<ModuleIconProps> = ({ module, size = 'sm', className }) => {
  const Icon = module.icon;
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-b after:from-white/30 after:to-transparent after:opacity-70',
        SIZES[size],
        module.tint,
        className
      )}
    >
      <Icon className="relative z-10 stroke-[2.2]" />
    </span>
  );
};
