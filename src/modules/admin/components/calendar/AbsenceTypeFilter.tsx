import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ABSENCE_TYPE_KEYS, absenceTypeLabels } from '@/lib/absence-types';
import { entryStyle } from './entryStyle';

interface AbsenceTypeFilterProps {
  /** Tipos à vista (férias, baixas, consultas…). */
  value: ReadonlySet<string>;
  onChange: (types: Set<string>) => void;
  className?: string;
}

/**
 * Que tipos de ausência mostrar: um botão por tipo, com a cor do tipo (serve também de
 * legenda). "Todos" volta a mostrar tudo; não se pode ficar sem nenhum.
 */
export const AbsenceTypeFilter: React.FC<AbsenceTypeFilterProps> = ({
  value,
  onChange,
  className,
}) => {
  const all = ABSENCE_TYPE_KEYS.every(type => value.has(type));
  const toggle = (type: string) => {
    const next = new Set(value);
    if (!next.delete(type)) next.add(type);
    if (next.size) onChange(next);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="mr-1 text-[12.5px] font-semibold text-rz-muted">Mostrar</span>
      <button
        type="button"
        onClick={() => onChange(new Set(ABSENCE_TYPE_KEYS))}
        aria-pressed={all}
        className={cn(
          'h-8 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition-colors',
          all
            ? 'bg-rz-ink text-white ring-transparent'
            : 'text-rz-muted ring-rz-line hover:bg-rz-canvas'
        )}
      >
        Todos
      </button>
      {ABSENCE_TYPE_KEYS.map(type => {
        const on = value.has(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={on}
            title={
              on ? `Esconder ${absenceTypeLabels[type]}` : `Mostrar ${absenceTypeLabels[type]}`
            }
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition-colors',
              on
                ? 'bg-white text-rz-ink ring-rz-line'
                : 'text-rz-muted/70 ring-transparent hover:bg-rz-canvas'
            )}
          >
            <span
              className={cn(
                'flex h-3.5 w-3.5 items-center justify-center rounded',
                !on && 'opacity-35'
              )}
              style={entryStyle({ type, status: 'approved' })}
              aria-hidden
            >
              {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className={cn(!on && 'line-through')}>{absenceTypeLabels[type]}</span>
          </button>
        );
      })}
    </div>
  );
};
