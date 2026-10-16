// Conversão das várias fontes (eventos, ausências, feriados, tarefas) em blocos do calendário.
import { endOfDay, startOfDay } from 'date-fns';
import { countBusinessDays, type Holiday } from '@/lib/vacation-utils';
import { absenceTypeLabels } from '@/lib/absence-types';
import type { AbsenceRow } from '@/modules/absences/lib/absenceRules';
import { safetyCheckupView } from '@/lib/employee-home';
import type { Task } from '@/modules/tasks/types';
import type { CalendarEvent, CalendarItem, CalendarLayer, EventColor } from '../types';
import { expandOccurrences } from './recurrence';

export const EVENT_TONES: Record<EventColor, string> = {
  violet: 'bg-violet-100 text-violet-800',
  sky: 'bg-sky-100 text-sky-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  rose: 'bg-rose-100 text-rose-800',
  slate: 'bg-slate-200 text-slate-700',
};

export const EVENT_DOTS: Record<EventColor, string> = {
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
};

export const LAYERS: { key: CalendarLayer; label: string; dot: string }[] = [
  { key: 'mine', label: 'Os meus eventos', dot: 'bg-violet-500' },
  { key: 'invites', label: 'Convites', dot: 'bg-sky-500' },
  { key: 'company', label: 'Eventos da empresa', dot: 'bg-indigo-500' },
  { key: 'absences', label: 'As minhas férias e ausências', dot: 'bg-emerald-500' },
  { key: 'team', label: 'Ausências do departamento', dot: 'bg-slate-400' },
  { key: 'holidays', label: 'Feriados', dot: 'bg-rose-400' },
  { key: 'health', label: 'Higiene e segurança', dot: 'bg-sky-500' },
  { key: 'tasks', label: 'Prazos de tarefas', dot: 'bg-amber-500' },
];

const dateOnly = (iso: string, end = false) => {
  const day = new Date(`${iso}T00:00:00`);
  return end ? endOfDay(day) : startOfDay(day);
};

interface BuildInput {
  from: Date;
  to: Date;
  myUserId: string;
  events: CalendarEvent[];
  absences: AbsenceRow[];
  /** Colegas do mesmo departamento, só os dias aprovados (rz_team_absences). */
  team?: { employee_id: string; name: string; start_date: string; end_date: string }[];
  holidays: Holiday[];
  tasks: Task[];
  /** Consulta de higiene e segurança da ficha (data e periodicidade em meses). */
  health?: { date: string | null; renewalMonths: number | null };
}

export const buildItems = (input: BuildInput): CalendarItem[] => {
  const items: CalendarItem[] = [];
  for (const event of input.events) {
    const layer: CalendarLayer =
      event.ownerId === input.myUserId
        ? 'mine'
        : event.attendees.some(a => a.userId === input.myUserId)
          ? 'invites'
          : 'company';
    for (const occ of expandOccurrences(event, input.from, input.to)) {
      items.push({
        key: `${event.id}-${occ.start.getTime()}`,
        layer,
        title: event.title,
        start: occ.start,
        end: occ.end,
        allDay: event.allDay,
        tone: EVENT_TONES[event.color],
        event,
      });
    }
  }
  for (const absence of input.absences) {
    if (absence.status === 'rejected') continue;
    // Um pedido pode ter vários períodos (ex.: abril, setembro e dezembro): desenha-se cada
    // período, e não o intervalo do primeiro ao último dia.
    const periods = absence.absence_periods?.length
      ? absence.absence_periods.filter(p => p.status !== 'rejected')
      : [
          {
            id: 'all',
            start_date: absence.start_date,
            end_date: absence.end_date,
            status: absence.status,
          },
        ];
    const spans = periods.map(period => ({
      key: period.id,
      start: dateOnly(period.start_date),
      end: dateOnly(period.end_date, true),
      pending: absence.status === 'pending' || period.status === 'pending',
    }));
    for (const period of periods) {
      const pending = absence.status === 'pending' || period.status === 'pending';
      const partial = 'period_type' in period && period.period_type === 'partial';
      const days =
        'business_days' in period && typeof period.business_days === 'number'
          ? period.business_days
          : countBusinessDays(
              dateOnly(period.start_date),
              dateOnly(period.end_date),
              input.holidays
            );
      items.push({
        key: `abs-${absence.id}-${period.id}`,
        layer: 'absences',
        title: `${absenceTypeLabels[absence.absence_type] ?? 'Ausência'}${pending ? ' (pendente)' : ''}`,
        start: dateOnly(period.start_date),
        end: dateOnly(period.end_date, true),
        allDay: true,
        tone: pending
          ? 'bg-amber-50 text-amber-800 ring-1 ring-dashed ring-amber-300'
          : 'bg-emerald-100 text-emerald-800',
        info: {
          kind: 'absence',
          typeLabel: absenceTypeLabels[absence.absence_type] ?? 'Ausência',
          pending,
          days,
          hours:
            partial && 'start_time' in period && period.start_time && period.end_time
              ? `${period.start_time.slice(0, 5)} – ${period.end_time.slice(0, 5)}`
              : undefined,
          notes: absence.notes,
          siblings: spans.filter(span => span.key !== period.id),
        },
      });
    }
  }
  for (const absence of input.team ?? []) {
    items.push({
      key: `team-${absence.employee_id}-${absence.start_date}`,
      layer: 'team',
      title: `${absence.name.split(' ')[0]} · ausente`,
      start: dateOnly(absence.start_date),
      end: dateOnly(absence.end_date, true),
      allDay: true,
      tone: 'bg-slate-100 text-slate-600',
      info: { kind: 'team', name: absence.name },
    });
  }
  const checkup = safetyCheckupView(
    input.health?.date ?? null,
    input.health?.renewalMonths ?? null
  );
  if (checkup) {
    items.push({
      key: `health-${checkup.kind}`,
      layer: 'health',
      title: checkup.kind === 'scheduled' ? 'Consulta de HST' : 'Consulta de HST (prevista)',
      start: startOfDay(checkup.date),
      end: endOfDay(checkup.date),
      allDay: true,
      tone:
        checkup.kind === 'scheduled'
          ? 'bg-sky-100 text-sky-800'
          : 'bg-sky-50 text-sky-700 ring-1 ring-dashed ring-sky-300',
      info: {
        kind: 'health',
        scheduled: checkup.kind === 'scheduled',
        renewalMonths: input.health?.renewalMonths ?? null,
      },
    });
  }
  for (const holiday of input.holidays) {
    items.push({
      key: `hol-${holiday.id}`,
      layer: 'holidays',
      title: holiday.name,
      start: dateOnly(holiday.date),
      end: dateOnly(holiday.date, true),
      allDay: true,
      tone: 'bg-rose-50 text-rose-700',
      info: { kind: 'holiday', name: holiday.name, national: holiday.is_national },
    });
  }
  for (const task of input.tasks) {
    if (!task.dueAt || task.status === 'done') continue;
    const due = new Date(task.dueAt);
    items.push({
      key: `task-${task.id}`,
      layer: 'tasks',
      title: `✓ ${task.title}`,
      start: due,
      end: due,
      allDay: false,
      tone: 'bg-amber-100 text-amber-900',
      taskId: task.id,
    });
  }
  return items
    .filter(item => item.start <= input.to && item.end >= input.from)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
};
