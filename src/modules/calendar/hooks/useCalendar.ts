// Calendário: eventos do intervalo (com tempo real), ausências, feriados e prazos de tarefas,
// mais as ações sobre eventos. Na pré-visualização, em memória.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMyAbsences } from '@/modules/absences/hooks/useMyAbsences';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_EVENTS } from '../lib/demoData';
import { buildItems } from '../lib/items';
import { calendarService } from '../services/calendarService';
import type { AttendeeResponse, CalendarEvent, EventInput } from '../types';

let demoEvents: CalendarEvent[] = DEMO_EVENTS;
const listeners = new Set<() => void>();
const setDemo = (update: (list: CalendarEvent[]) => CalendarEvent[]) => {
  demoEvents = update(demoEvents);
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const fail = (description: string): void => {
  toast({ title: 'Não foi possível', description, variant: 'destructive' });
};

const fromInput = (id: string, ownerId: string, input: EventInput): CalendarEvent => ({
  id,
  ownerId,
  title: input.title,
  description: input.description || null,
  location: input.location || null,
  meetingUrl: input.meetingUrl || null,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  allDay: input.allDay,
  visibility: input.visibility,
  recurrence: input.recurrence,
  recurrenceUntil: input.recurrenceUntil,
  reminderMinutes: input.reminderMinutes,
  color: input.color,
  attendees: input.attendeeIds.map(userId => ({ userId, response: 'pending' as const })),
});

/** Só criar eventos (ex.: a partir de um email), sem carregar o calendário. */
export const useCreateEvent = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  return async (input: EventInput) => {
    if (isPreview)
      return void setDemo(list => [...list, fromInput(`demo-${Date.now()}`, user.userId, input)]);
    const { error } = await calendarService.create(user.companyId, user.userId, input);
    if (error) return fail('O evento não foi criado.');
    toast({ title: 'Evento criado' });
    await qc.invalidateQueries({ queryKey: ['calendar'] });
  };
};

export const useCalendar = (from: Date, to: Date) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const create = useCreateEvent();
  const demo = useSyncExternalStore(subscribe, () => demoEvents);
  const absences = useMyAbsences();
  const { tasks } = useTasks();
  const range = [from.toISOString(), to.toISOString()] as const;

  const events = useQuery({
    queryKey: ['calendar', 'events', ...range],
    queryFn: async () => {
      const { data, error } = await calendarService.listEvents(from, to);
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
  });
  const team = useQuery({
    queryKey: ['calendar', 'team', ...range],
    queryFn: async () => (await calendarService.listTeamAbsences(from, to)).data,
    enabled: !isPreview,
  });

  useEffect(() => {
    if (isPreview) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ['calendar'] });
    const channel = supabase
      .channel(`calendar-${user.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, refresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_attendees' },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, user.userId, qc]);

  const eventList = isPreview ? demo : (events.data ?? []);
  const items = useMemo(
    () =>
      buildItems({
        from,
        to,
        myUserId: user.userId,
        events: eventList,
        absences: absences.data?.absences ?? [],
        team: team.data ?? [],
        holidays: absences.data?.holidays ?? [],
        tasks,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- from/to entram pela chave range
    [range[0], range[1], eventList, absences.data, team.data, tasks, user]
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ['calendar'] });

  return {
    items,
    events: eventList,
    balance: absences.data,
    isLoading: !isPreview && events.isLoading,
    create,
    update: async (event: CalendarEvent, input: EventInput) => {
      if (isPreview)
        return void setDemo(list =>
          list.map(e => (e.id === event.id ? fromInput(e.id, e.ownerId, input) : e))
        );
      const { error } = await calendarService.update(event, input);
      if (error) return fail('O evento não foi guardado.');
      await refresh();
    },
    remove: async (event: CalendarEvent) => {
      if (isPreview) return void setDemo(list => list.filter(e => e.id !== event.id));
      const { error } = await calendarService.remove(event.id);
      if (error) return fail('O evento não foi eliminado.');
      await refresh();
    },
    respond: async (event: CalendarEvent, response: AttendeeResponse) => {
      if (isPreview) {
        return void setDemo(list =>
          list.map(e =>
            e.id === event.id
              ? {
                  ...e,
                  attendees: e.attendees.map(a =>
                    a.userId === user.userId ? { ...a, response } : a
                  ),
                }
              : e
          )
        );
      }
      const { error } = await calendarService.respond(event.id, user.userId, response);
      if (error) return fail('A resposta não foi guardada.');
      await refresh();
    },
  };
};
