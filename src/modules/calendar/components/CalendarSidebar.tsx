import React from 'react';
import { cn } from '@/lib/utils';
import { LAYERS } from '../lib/items';
import type { CalendarLayer } from '../types';

interface CalendarSidebarProps {
  hidden: Set<CalendarLayer>;
  onToggle: (layer: CalendarLayer) => void;
}

/** Que calendários estão visíveis. */
export const CalendarSidebar: React.FC<CalendarSidebarProps> = props => {
  return (
    <aside className="space-y-4">
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
