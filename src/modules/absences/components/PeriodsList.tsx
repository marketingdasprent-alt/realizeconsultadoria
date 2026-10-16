import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PeriodGroup, PeriodItem } from '../lib/periodItems';
import { PeriodRow, type PeriodRowActions } from './PeriodRow';

interface PeriodsListProps extends PeriodRowActions {
  groups: Record<PeriodGroup, PeriodItem[]>;
  highlightId: string | null;
  onHover: (id: string | null) => void;
}

const Title: React.FC<{ tone?: string; children: React.ReactNode }> = ({ tone, children }) => (
  <h3
    className={cn(
      'mb-1 mt-5 px-1 text-[12px] font-bold uppercase tracking-[0.1em]',
      tone ?? 'text-rz-muted'
    )}
  >
    {children}
  </h3>
);

/** Precisam de atenção, próximos e histórico (recolhido): cada linha é um período. */
export const PeriodsList: React.FC<PeriodsListProps> = ({
  groups,
  highlightId,
  onHover,
  ...actions
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const row = (item: PeriodItem) => (
    <PeriodRow
      key={item.id}
      item={item}
      highlighted={highlightId === item.id}
      onHover={onHover}
      {...actions}
    />
  );
  const empty = !groups.attention.length && !groups.upcoming.length && !groups.history.length;
  return (
    <section
      className="mt-5 rounded-[26px] bg-white p-3 shadow-rz-soft ring-1 ring-rz-line md:p-4"
      aria-label="Os meus períodos"
    >
      {empty && (
        <p className="p-8 text-center text-rz-muted">
          Ainda não tem férias nem ausências registadas.
        </p>
      )}
      {groups.attention.length > 0 && (
        <>
          <Title tone="text-rose-600">Precisam de si · {groups.attention.length}</Title>
          <ul className="space-y-1">{groups.attention.map(row)}</ul>
        </>
      )}
      {groups.upcoming.length > 0 && (
        <>
          <Title>Próximos · {groups.upcoming.length}</Title>
          <ul className="space-y-0.5">{groups.upcoming.map(row)}</ul>
        </>
      )}
      {groups.upcoming.length === 0 && groups.attention.length === 0 && !empty && (
        <p className="p-6 text-center text-[14px] text-rz-muted">
          Sem férias nem ausências marcadas.
        </p>
      )}
      {groups.history.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="mb-1 mt-5 flex w-full items-center gap-1 px-1 text-left text-[12px] font-bold uppercase tracking-[0.1em] text-rz-muted"
            aria-expanded={showHistory}
          >
            Histórico · {groups.history.length}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showHistory && 'rotate-180')}
            />
          </button>
          {showHistory && <ul className="space-y-0.5">{groups.history.map(row)}</ul>}
        </>
      )}
    </section>
  );
};
