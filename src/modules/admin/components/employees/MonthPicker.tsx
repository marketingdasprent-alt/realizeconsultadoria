import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthPickerProps {
  /** AAAA-MM */
  value: string;
  onChange: (value: string) => void;
  /** Meses depois deste (AAAA-MM) ficam desativados. */
  max?: string;
}

/** Ano com setas e os 12 meses em botões (sem o seletor nativo do browser). */
export const MonthPicker: React.FC<MonthPickerProps> = ({ value, onChange, max }) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const set = (y: number, m: number) => {
    const next = `${y}-${String(m).padStart(2, '0')}`;
    onChange(max && next > max ? max : next);
  };
  const disabled = (y: number, m: number) => !!max && `${y}-${String(m).padStart(2, '0')}` > max;

  return (
    <div className="rounded-[20px] bg-rz-canvas p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => set(year - 1, month)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white"
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[15px] font-extrabold tabular-nums">{year}</span>
        <button
          type="button"
          onClick={() => set(year + 1, month)}
          disabled={disabled(year + 1, 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white disabled:opacity-30"
          aria-label="Ano seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {MONTHS.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={disabled(year, index + 1)}
            onClick={() => set(year, index + 1)}
            className={cn(
              'h-9 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-30',
              month === index + 1 ? 'bg-rz-ink text-white' : 'bg-white hover:bg-rz-primary-soft'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
