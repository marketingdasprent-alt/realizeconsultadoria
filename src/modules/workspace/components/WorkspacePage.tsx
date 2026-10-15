import React from 'react';
import { cn } from '@/lib/utils';

interface WorkspacePageProps {
  children: React.ReactNode;
  /** Largura máxima do conteúdo (as páginas antigas usam a coluna estreita). */
  width?: 'narrow' | 'wide' | 'full';
  className?: string;
}

const WIDTHS = {
  narrow: 'max-w-3xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
};

/**
 * Página com deslocamento próprio dentro do painel central; deixa espaço para a
 * barra inferior no telemóvel.
 */
export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  children,
  width = 'wide',
  className,
}) => (
  <div className="rz-scroll h-full overflow-y-auto">
    <div
      className={cn(
        'rz-rise mx-auto w-full px-4 pb-32 pt-5 md:px-8 md:pb-10 md:pt-7',
        WIDTHS[width],
        className
      )}
    >
      {children}
    </div>
  </div>
);
