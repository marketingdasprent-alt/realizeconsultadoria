import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { yearPosition, yearSegments, type PeriodItem, type PeriodStatus } from '../lib/periodItems';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const COLOR: Record<PeriodStatus, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-400',
  rejected: 'bg-rose-500',
};

const LEGEND: { status: PeriodStatus; label: string }[] = [
  { status: 'approved', label: 'Aprovado' },
  { status: 'pending', label: 'À espera dos RH' },
  { status: 'rejected', label: 'Rejeitado' },
];

interface YearStripProps {
  items: PeriodItem[];
  year: number;
  /** Período em destaque (o da linha em que o rato está, ou o último escolhido). */
  highlightId: string | null;
  onSelect: (id: string) => void;
}

/** O ano numa faixa: um bloco por período, para ver de relance quando se está fora. */
export const YearStrip: React.FC<YearStripProps> = ({ items, year, highlightId, onSelect }) => {
  const segments = useMemo(() => yearSegments(items, year), [items, year]);
  const today = yearPosition(new Date().toISOString().slice(0, 10), year);
  return (
    <section
      className="rounded-[26px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line md:p-5"
      aria-label="Os meus dias no ano"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">Os meus dias</h2>
        <span className="text-[12.5px] text-rz-muted">{year}</span>
      </div>
      <div className="mt-3 grid grid-cols-12 text-center text-[11px] font-semibold uppercase text-rz-muted">
        {MONTHS.map(month => (
          <span key={month}>{month}</span>
        ))}
      </div>
      <div className="relative mt-1 h-8 overflow-hidden rounded-xl bg-rz-canvas">
        {MONTHS.slice(1).map((month, index) => (
          <span
            key={month}
            className="absolute inset-y-0 w-px bg-white"
            style={{ left: `${((index + 1) / 12) * 100}%` }}
            aria-hidden
          />
        ))}
        {segments.map(segment => (
          <button
            key={segment.id}
            type="button"
            onClick={() => onSelect(segment.id)}
            style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            className={cn(
              'absolute inset-y-1.5 rounded-md transition-transform hover:scale-y-110',
              COLOR[segment.status],
              highlightId === segment.id && 'ring-2 ring-rz-primary ring-offset-1'
            )}
            aria-label="Ver este período"
          />
        ))}
        {today !== null && (
          <span
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-rz-primary"
            style={{ left: `${today}%` }}
            aria-hidden
          />
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-rz-muted">
        {LEGEND.map(({ status, label }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-[3px]', COLOR[status])} /> {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-rz-primary" /> Hoje
        </li>
      </ul>
    </section>
  );
};
