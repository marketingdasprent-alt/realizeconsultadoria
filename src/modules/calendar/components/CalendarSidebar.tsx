import React from 'react';
import { Palmtree, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDays, summarizeBalance } from '@/modules/absences/lib/absenceRules';
import type { AbsencesData } from '@/modules/absences/services/absenceRequestService';
import { LAYERS } from '../lib/items';
import type { CalendarLayer } from '../types';

interface CalendarSidebarProps {
  hidden: Set<CalendarLayer>;
  onToggle: (layer: CalendarLayer) => void;
  balance?: AbsencesData;
  selecting: boolean;
  selectedCount: number;
  onStartSelecting: () => void;
  onCancelSelecting: () => void;
  onRequestVacation: () => void;
}

/** Calendários visíveis e férias (briefing §10: o saldo de férias tem destaque aqui). */
export const CalendarSidebar: React.FC<CalendarSidebarProps> = props => {
  const summary = props.balance?.balance
    ? summarizeBalance(
        props.balance.balance,
        props.balance.scheduledByEmployee,
        props.balance.pendingVacationDays
      )
    : null;
  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-rz-soft">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <Palmtree className="h-4 w-4" /> Férias {new Date().getFullYear()}
        </p>
        {summary ? (
          <>
            <p className="mt-1 text-4xl font-extrabold">
              {formatDays(summary.available)}{' '}
              <span className="text-base font-semibold text-white/80">disponíveis</span>
            </p>
            <p className="mt-1 text-[12.5px] text-white/85">
              {formatDays(summary.used)} usados · {formatDays(summary.pending)} pendentes
              {summary.remainingSelf !== null &&
                ` · pode marcar ${formatDays(summary.remainingSelf)}`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-white/90">Saldo por configurar.</p>
        )}
        {props.selecting ? (
          <div className="mt-4 space-y-2">
            <p className="text-[12.5px] font-semibold">
              Toque nos dias que quer marcar ({props.selectedCount}).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!props.selectedCount}
                onClick={props.onRequestVacation}
                className="flex-1 rounded-full bg-white py-2 text-[13px] font-bold text-emerald-700 disabled:opacity-60"
              >
                Pedir estes dias
              </button>
              <button
                type="button"
                onClick={props.onCancelSelecting}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={props.onStartSelecting}
            className="mt-4 w-full rounded-full bg-white py-2.5 text-[13.5px] font-bold text-emerald-700"
          >
            Marcar férias no calendário
          </button>
        )}
      </section>
      <section className="rounded-[26px] bg-white p-4 ring-1 ring-rz-line">
        <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-rz-muted">
          Calendários
        </p>
        <ul className="space-y-0.5">
          {LAYERS.map(layer => {
            const visible = !props.hidden.has(layer.key);
            return (
              <li key={layer.key}>
                <button
                  type="button"
                  onClick={() => props.onToggle(layer.key)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13.5px] font-semibold hover:bg-rz-canvas"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-md',
                      visible ? layer.dot : 'ring-2 ring-rz-line'
                    )}
                  />
                  <span className={cn(!visible && 'text-rz-muted')}>{layer.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
};
