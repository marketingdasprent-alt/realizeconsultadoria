import React, { useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MonthPicker } from '../employees/MonthPicker';

interface MonthSwitcherProps {
  year: number;
  /** 1 = janeiro */
  month: number;
  onChange: (year: number, month: number) => void;
}

/** Mês anterior / seguinte e, ao clicar no nome, os 12 meses do ano para escolher. */
export const MonthSwitcher: React.FC<MonthSwitcherProps> = ({ year, month, onChange }) => {
  const [open, setOpen] = useState(false);
  const shift = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    onChange(date.getFullYear(), date.getMonth() + 1);
  };
  const value = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1 rounded-full bg-rz-canvas p-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 min-w-[150px] items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-extrabold capitalize hover:bg-white"
          >
            <CalendarDays className="h-4 w-4 text-rz-muted" />
            {format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: pt })}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] rounded-[22px] p-2" align="start">
          <MonthPicker
            value={value}
            onChange={next => {
              const nextYear = Number(next.slice(0, 4));
              const nextMonth = Number(next.slice(5, 7));
              onChange(nextYear, nextMonth);
              // Mudar só o ano (setas) deixa a escolha aberta; escolher o mês fecha.
              if (!(nextYear !== year && nextMonth === month)) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => shift(1)}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white"
        aria-label="Mês seguinte"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
