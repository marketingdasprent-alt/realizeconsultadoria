import React from 'react';
import { entryStyle } from './entryStyle';

/** Legenda numa linha: pendente tracejado, horas, feriado e fim de semana (as cores dos tipos
 * estão no filtro "Mostrar", por cima do calendário). */
export const AbsenceLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[12.5px] text-rz-muted">
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-5 rounded"
        style={entryStyle({ type: 'other', status: 'pending' })}
        aria-hidden
      />
      Pendente
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-5 rounded bg-slate-400" aria-hidden />
      Horas
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[12px] font-bold text-rose-600">12</span>
      Feriado
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-5 rounded bg-rz-canvas ring-1 ring-rz-line" aria-hidden />
      Fim de semana
    </span>
  </div>
);
