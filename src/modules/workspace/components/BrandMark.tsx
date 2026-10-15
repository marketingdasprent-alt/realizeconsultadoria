import React, { useId } from 'react';
import { cn } from '@/lib/utils';

// Alturas das barras do símbolo Realize (grupo baixo à esquerda, alto à direita).
const BARS = [14, 13, 12, 11, 10, 9, 22, 21, 20, 19, 18, 17];

interface BrandMarkProps {
  /** Mostra o nome ao lado do símbolo. */
  withName?: boolean;
  className?: string;
}

/** Símbolo dourado da Realize (barras) + nome, legível sobre a aurora. */
export const BrandMark: React.FC<BrandMarkProps> = ({ withName = true, className }) => {
  // Id único: o menu lateral (escondido no telemóvel) e a barra superior têm cada um o seu
  // símbolo, e um gradiente dentro de um elemento escondido deixa de pintar os outros.
  const gradientId = `rz-brand-gold-${useId().replace(/:/g, '')}`;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 34 26" className="h-8 w-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3D9A4" />
            <stop offset="1" stopColor="#C9A15B" />
          </linearGradient>
        </defs>
        {BARS.map((height, index) => (
          <rect
            key={index}
            x={1 + index * 2.75 + (index >= 6 ? 0.6 : 0)}
            y={25 - height}
            width={1.5}
            height={height}
            rx={0.75}
            fill={`url(#${gradientId})`}
          />
        ))}
      </svg>
      {withName && (
        <span className="leading-none">
          <span className="block text-[19px] font-extrabold tracking-tight text-white">
            Realize
          </span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
            Workplace
          </span>
        </span>
      )}
    </span>
  );
};
