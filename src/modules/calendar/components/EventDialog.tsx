import React, { useEffect, useRef, useState } from 'react';
import { addHours, format, setHours, startOfHour } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PeoplePicker } from '@/modules/social/components/PeoplePicker';
import { EVENT_DOTS } from '../lib/items';
import type {
  CalendarEvent,
  EventColor,
  EventInput,
  EventRecurrence,
  EventVisibility,
} from '../types';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  /** Dia sugerido para um evento novo. */
  day?: Date | null;
  /** Título e descrição de um evento novo (ex.: a partir de um email). */
  initial?: Partial<Pick<EventInput, 'title' | 'description'>>;
  onSave: (input: EventInput) => Promise<void>;
}

const FIELD =
  'h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';
const LABEL = 'mb-1.5 block text-[13px] font-bold';
const local = (iso: string, allDay: boolean) =>
  format(new Date(iso), allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");

const defaults = (day?: Date | null): EventInput => {
  const start = day ? setHours(day, 10) : addHours(startOfHour(new Date()), 1);
  return {
    title: '',
    description: '',
    location: '',
    meetingUrl: '',
    startsAt: start.toISOString(),
    endsAt: addHours(start, 1).toISOString(),
    allDay: false,
    visibility: 'participants',
    recurrence: null,
    recurrenceUntil: null,
    reminderMinutes: 15,
    color: 'violet',
    attendeeIds: [],
  };
};

/** Criar ou editar um evento: data/hora, convidados, local, ligação, recorrência e lembrete. */
export const EventDialog: React.FC<EventDialogProps> = ({
  open,
  onOpenChange,
  event,
  day,
  initial,
  onSave,
}) => {
  const [form, setForm] = useState<EventInput>(defaults());
  const [isSaving, setIsSaving] = useState(false);
  const dayRef = useRef(day);
  dayRef.current = day;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) return;
    setForm(
      event
        ? {
            title: event.title,
            description: event.description ?? '',
            location: event.location ?? '',
            meetingUrl: event.meetingUrl ?? '',
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            allDay: event.allDay,
            visibility: event.visibility,
            recurrence: event.recurrence,
            recurrenceUntil: event.recurrenceUntil,
            reminderMinutes: event.reminderMinutes,
            color: event.color,
            attendeeIds: event.attendees.map(a => a.userId),
          }
        : { ...defaults(dayRef.current), ...initialRef.current }
    );
  }, [open, event]);

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) =>
    setForm(f => ({ ...f, [key]: value }));
  const setTime = (key: 'startsAt' | 'endsAt', value: string) => {
    if (!value) return;
    const date = new Date(
      form.allDay ? `${value}T${key === 'startsAt' ? '00:00' : '23:59'}` : value
    );
    setForm(f => {
      const next = { ...f, [key]: date.toISOString() };
      if (key === 'startsAt' && new Date(next.endsAt) < date)
        next.endsAt = addHours(date, 1).toISOString();
      return next;
    });
  };
  const valid = form.title.trim() && new Date(form.endsAt) >= new Date(form.startsAt);

  const save = async () => {
    if (!valid) return;
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold">
            {event ? 'Editar evento' : 'Novo evento'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input
            autoFocus
            value={form.title}
            onChange={e => set('title', e.target.value.slice(0, 200))}
            placeholder="Título do evento"
            className={cn(FIELD, 'h-12 text-[15px] font-semibold')}
          />
          <label className="flex items-center gap-2 text-[13.5px] font-semibold">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={e => set('allDay', e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />{' '}
            Dia inteiro
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Início</span>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={local(form.startsAt, form.allDay)}
                onChange={e => setTime('startsAt', e.target.value)}
                className={FIELD}
              />
            </label>
            <label>
              <span className={LABEL}>Fim</span>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={local(form.endsAt, form.allDay)}
                onChange={e => setTime('endsAt', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>
          <div>
            <span className={LABEL}>Convidados</span>
            <PeoplePicker
              value={form.attendeeIds}
              onChange={ids => {
                set('attendeeIds', ids);
                // Convidados só veem o evento se ele não for privado.
                if (ids.length && form.visibility === 'private') set('visibility', 'participants');
              }}
              placeholder="Convidar"
            />
          </div>
          <input
            value={form.location}
            onChange={e => set('location', e.target.value.slice(0, 300))}
            placeholder="Local (opcional)"
            className={FIELD}
          />
          <input
            value={form.meetingUrl}
            onChange={e => set('meetingUrl', e.target.value.slice(0, 500))}
            placeholder="Ligação da reunião (Meet, Teams, Zoom…)"
            className={FIELD}
          />
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value.slice(0, 5000))}
            rows={2}
            placeholder="Descrição (opcional)"
            className={cn(FIELD, 'h-auto resize-none py-3')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Repetir</span>
              <select
                value={form.recurrence ?? ''}
                onChange={e =>
                  set('recurrence', (e.target.value || null) as EventRecurrence | null)
                }
                className={FIELD}
              >
                <option value="">Não repete</option>
                <option value="daily">Todos os dias</option>
                <option value="weekly">Todas as semanas</option>
                <option value="monthly">Todos os meses</option>
                <option value="yearly">Todos os anos</option>
              </select>
            </label>
            {form.recurrence ? (
              <label>
                <span className={LABEL}>Até</span>
                <input
                  type="date"
                  value={form.recurrenceUntil ?? ''}
                  onChange={e => set('recurrenceUntil', e.target.value || null)}
                  className={FIELD}
                />
              </label>
            ) : (
              <label>
                <span className={LABEL}>Lembrete</span>
                <select
                  value={form.reminderMinutes ?? ''}
                  onChange={e =>
                    set('reminderMinutes', e.target.value === '' ? null : Number(e.target.value))
                  }
                  className={FIELD}
                >
                  <option value="">Sem lembrete</option>
                  <option value="0">Na hora</option>
                  <option value="10">10 minutos antes</option>
                  <option value="15">15 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
              </label>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Quem vê</span>
              <select
                value={form.visibility}
                onChange={e => set('visibility', e.target.value as EventVisibility)}
                className={FIELD}
              >
                <option value="participants">Eu e os convidados</option>
                <option value="company">Toda a empresa</option>
                <option value="private" disabled={form.attendeeIds.length > 0}>
                  Só eu
                </option>
              </select>
            </label>
            <div>
              <span className={LABEL}>Cor</span>
              <div className="flex h-11 items-center gap-2">
                {(Object.keys(EVENT_DOTS) as EventColor[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    aria-label={c}
                    className={cn(
                      'h-7 w-7 rounded-full ring-offset-2',
                      EVENT_DOTS[c],
                      form.color === c && 'ring-2 ring-rz-ink'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!valid || isSaving}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{' '}
          {event ? 'Guardar' : 'Criar evento'}
        </button>
      </DialogContent>
    </Dialog>
  );
};
