import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Coffee, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deriveWorkday } from '@/lib/workday';
import { useWorkday } from '../../context/useWorkday';
import { useNow } from '../../hooks/useNow';
import { getWorkdayStatusText } from './workdayStyles';

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const GRADIENTS = {
  working: 'from-indigo-500 via-violet-500 to-fuchsia-500',
  paused: 'from-amber-400 via-orange-400 to-rose-400',
  closed: 'from-slate-600 via-indigo-700 to-violet-700',
};

/** Hoje: estado da jornada, cronómetro grande, início e pausas. */
export const TodayHero: React.FC = () => {
  const { entries } = useWorkday();
  // Recalculado ao segundo (o contexto só atualiza de 30 em 30 s).
  const now = useNow(1000);
  const workday = useMemo(() => deriveWorkday(entries, now), [entries, now]);
  const workedMs = workday.workedMs;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[32px] bg-gradient-to-br p-6 text-white shadow-rz-soft md:p-8',
        GRADIENTS[workday.status]
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/15 blur-3xl"
        aria-hidden
      />
      <p className="text-sm font-semibold text-white/80 first-letter:uppercase">
        {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
      </p>
      <p className="mt-1 flex items-center gap-2 text-[15px] font-bold">
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            workday.status === 'working' ? 'animate-pulse bg-emerald-300' : 'bg-white/70'
          )}
        />
        {getWorkdayStatusText(workday)}
      </p>
      <p className="mt-3 text-5xl font-extrabold tabular-nums tracking-tight md:text-6xl">
        {clock(workedMs)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-semibold">
        {workday.startedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
            <PlayCircle className="h-4 w-4" /> Início {format(new Date(workday.startedAt), 'HH:mm')}
          </span>
        )}
        {workday.breakMs > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5">
            <Coffee className="h-4 w-4" /> Pausas {clock(workday.breakMs).slice(0, -3)}
          </span>
        )}
        {workday.endedAt && (
          <span className="rounded-full bg-white/20 px-3 py-1.5">
            Fim {format(new Date(workday.endedAt), 'HH:mm')}
          </span>
        )}
      </div>
    </section>
  );
};
