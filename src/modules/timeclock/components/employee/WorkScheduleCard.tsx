import React, { useEffect, useState } from 'react';
import { AlarmClock, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import {
  DEFAULT_SCHEDULE,
  scheduleProblem,
  scheduleService,
  type WorkSchedule,
} from '../../services/scheduleService';

const DAYS = [
  [1, 'Seg'],
  [2, 'Ter'],
  [3, 'Qua'],
  [4, 'Qui'],
  [5, 'Sex'],
  [6, 'Sáb'],
  [7, 'Dom'],
] as const;
const TIME =
  'h-10 w-full rounded-xl bg-rz-canvas px-3 text-[14px] font-semibold outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';
const LABEL = 'mb-1 block text-[12px] font-semibold text-rz-muted';

/** "O meu horário": dias, entrada, almoço e saída — o Realize avisa se faltar picar. */
export const WorkScheduleCard: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [loaded, setLoaded] = useState(isPreview);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    void scheduleService.get(user.userId).then(saved => {
      if (saved) setSchedule(saved);
      setLoaded(true);
    });
  }, [isPreview, user.userId]);

  const set = (patch: Partial<WorkSchedule>) => setSchedule(s => ({ ...s, ...patch }));
  const problem = scheduleProblem(schedule);
  const hasLunch = !!schedule.lunchStart;

  const save = async () => {
    if (problem) return;
    if (isPreview) return void toast({ title: 'Horário guardado (pré-visualização)' });
    setSaving(true);
    const { error } = await scheduleService.save(user.userId, schedule);
    setSaving(false);
    toast(
      error
        ? { title: 'O horário não foi guardado', variant: 'destructive' }
        : {
            title: 'Horário guardado',
            description: 'Vai receber um aviso se se esquecer de picar.',
          }
    );
  };

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <AlarmClock className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-[16px] font-bold">O meu horário</h2>
          <p className="text-[13px] text-rz-muted">
            Se passar a hora e não tiver picado, o Realize avisa-o.
          </p>
        </div>
        <Switch
          checked={schedule.reminders}
          onCheckedChange={reminders => set({ reminders })}
          aria-label="Lembretes de ponto"
        />
      </div>

      {!loaded ? (
        <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-rz-primary" />
      ) : (
        <div className={cn('mt-4 space-y-4', !schedule.reminders && 'opacity-50')}>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map(([day, label]) => {
              const on = schedule.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    set({
                      days: on
                        ? schedule.days.filter(d => d !== day)
                        : [...schedule.days, day].sort(),
                    })
                  }
                  aria-pressed={on}
                  className={cn(
                    'h-9 min-w-11 rounded-full px-3 text-[13px] font-semibold ring-1',
                    on ? 'bg-rz-ink text-white ring-rz-ink' : 'text-rz-muted ring-rz-line'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={LABEL}>Entrada</span>
              <input
                type="time"
                value={schedule.startTime}
                onChange={e => set({ startTime: e.target.value })}
                className={TIME}
              />
            </label>
            <label>
              <span className={LABEL}>Saída</span>
              <input
                type="time"
                value={schedule.endTime}
                onChange={e => set({ endTime: e.target.value })}
                className={TIME}
              />
            </label>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13.5px] font-semibold">
            <input
              type="checkbox"
              checked={hasLunch}
              onChange={e =>
                set(
                  e.target.checked
                    ? { lunchStart: '13:00', lunchEnd: '14:00' }
                    : { lunchStart: null, lunchEnd: null }
                )
              }
              className="h-4 w-4 accent-violet-600"
            />
            Pausa para almoço
          </label>
          {hasLunch && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={LABEL}>Início do almoço</span>
                <input
                  type="time"
                  value={schedule.lunchStart ?? ''}
                  onChange={e => set({ lunchStart: e.target.value })}
                  className={TIME}
                />
              </label>
              <label>
                <span className={LABEL}>Fim do almoço</span>
                <input
                  type="time"
                  value={schedule.lunchEnd ?? ''}
                  onChange={e => set({ lunchEnd: e.target.value })}
                  className={TIME}
                />
              </label>
            </div>
          )}
          <label className="block">
            <span className={LABEL}>Avisar se não picar até</span>
            <select
              value={schedule.toleranceMin}
              onChange={e => set({ toleranceMin: Number(e.target.value) })}
              className={TIME}
            >
              {[5, 10, 15, 30].map(min => (
                <option key={min} value={min}>
                  {min} minutos depois da hora
                </option>
              ))}
            </select>
          </label>
          {problem && <p className="text-[13px] font-semibold text-rose-600">{problem}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={!!problem || saving || !loaded}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[14px] font-bold text-white disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar horário
      </button>
    </section>
  );
};
