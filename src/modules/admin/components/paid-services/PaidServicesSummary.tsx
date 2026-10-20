import React from 'react';
import { cn } from '@/lib/utils';
import { formatEuro, type PaidSummary } from '../../lib/paidServices';

const Tile: React.FC<{ label: string; value: string; hint: string; tone?: 'warn' | 'bad' }> = ({
  label,
  value,
  hint,
  tone,
}) => (
  <div
    className={cn(
      'rounded-2xl p-4 ring-1',
      tone === 'bad'
        ? 'bg-rose-50 ring-rose-200'
        : tone === 'warn'
          ? 'bg-amber-50 ring-amber-200'
          : 'bg-white ring-rz-line'
    )}
  >
    <p className="text-[12.5px] font-semibold text-rz-muted">{label}</p>
    <p className="mt-1 text-[22px] font-extrabold tabular-nums text-rz-ink">{value}</p>
    <p className="text-[12px] text-rz-muted">{hint}</p>
  </div>
);

/** Quanto se paga por mês/ano e o que está a vencer. */
export const PaidServicesSummary: React.FC<{ summary: PaidSummary }> = ({ summary }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Tile
      label="Por mês"
      value={formatEuro(summary.perMonth)}
      hint={`${summary.monthlyCount} ${summary.monthlyCount === 1 ? 'serviço mensal' : 'serviços mensais'}`}
    />
    <Tile
      label="Por ano"
      value={formatEuro(summary.perYear)}
      hint={`${summary.yearlyCount} ${summary.yearlyCount === 1 ? 'serviço anual' : 'serviços anuais'}${
        summary.otherCount ? ` · ${summary.otherCount} noutros ciclos` : ''
      }`}
    />
    <Tile
      label="A pagar em 30 dias"
      value={String(summary.dueSoon)}
      hint={summary.dueSoon > 0 ? formatEuro(summary.dueSoonAmount) : 'Nada a vencer'}
      tone={summary.dueSoon > 0 ? 'warn' : undefined}
    />
    <Tile
      label="Em atraso"
      value={String(summary.overdue)}
      hint={summary.overdue > 0 ? 'Renovação já passou' : 'Tudo em dia'}
      tone={summary.overdue > 0 ? 'bad' : undefined}
    />
  </div>
);
