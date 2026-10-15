import React from 'react';
import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Aviso por cima da área enquanto se arrastam ficheiros para ela. */
export const DropOverlay: React.FC<{ visible: boolean; label?: string; className?: string }> = ({
  visible,
  label = 'Largue os ficheiros para anexar',
  className,
}) =>
  visible ? (
    <div
      className={cn(
        'pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-rz-primary bg-rz-primary-soft/90 text-rz-primary backdrop-blur-sm',
        className
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-rz-soft">
        <Paperclip className="h-7 w-7" />
      </span>
      <p className="text-[15px] font-bold">{label}</p>
    </div>
  ) : null;
