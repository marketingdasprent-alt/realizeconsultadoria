// Calendário no Supabase: eventos e convidados.
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type {
  AttendeeResponse,
  CalendarEvent,
  EventColor,
  EventInput,
  EventRecurrence,
  EventVisibility,
} from '../types';

type EventRow = Database['public']['Tables']['calendar_events']['Row'] & {
  calendar_event_attendees: { user_id: string; response: string }[];
};

const toEvent = (row: EventRow): CalendarEvent => ({
  id: row.id,
  ownerId: row.owner_id,
  title: row.title,
  description: row.description,
  location: row.location,
  meetingUrl: row.meeting_url,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  allDay: row.all_day,
  visibility: row.visibility as EventVisibility,
  recurrence: row.recurrence as EventRecurrence | null,
  recurrenceUntil: row.recurrence_until,
  reminderMinutes: row.reminder_minutes,
  color: row.color as EventColor,
  attendees: (row.calendar_event_attendees ?? []).map(a => ({
    userId: a.user_id,
    response: a.response as AttendeeResponse,
  })),
});

const toRow = (input: EventInput) => ({
  title: input.title.trim(),
  description: input.description.trim() || null,
  location: input.location.trim() || null,
  meeting_url: input.meetingUrl.trim() || null,
  starts_at: input.startsAt,
  ends_at: input.endsAt,
  all_day: input.allDay,
  visibility: input.visibility,
  recurrence: input.recurrence,
  recurrence_until: input.recurrence ? input.recurrenceUntil : null,
  reminder_minutes: input.reminderMinutes,
  color: input.color,
});

export const calendarService = {
  /** Eventos visíveis que tocam o intervalo (os recorrentes vêm todos; a app expande-os). */
  listEvents: async (from: Date, to: Date) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, calendar_event_attendees(user_id, response)')
      .lte('starts_at', to.toISOString())
      .or(`ends_at.gte.${from.toISOString()},recurrence.not.is.null`)
      .order('starts_at');
    return { data: ((data ?? []) as EventRow[]).map(toEvent), error };
  },

  create: async (companyId: string, ownerId: string, input: EventInput) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({ ...toRow(input), company_id: companyId, owner_id: ownerId })
      .select('id')
      .single();
    if (error || !data) return { data: null, error };
    if (input.attendeeIds.length) {
      const res = await supabase
        .from('calendar_event_attendees')
        .insert(input.attendeeIds.map(user_id => ({ event_id: data.id, user_id })));
      if (res.error) return { data: data.id, error: res.error };
    }
    return { data: data.id, error: null };
  },

  update: async (event: CalendarEvent, input: EventInput) => {
    const { error } = await supabase
      .from('calendar_events')
      .update(toRow(input))
      .eq('id', event.id);
    if (error) return { error };
    const current = event.attendees.map(a => a.userId);
    const add = input.attendeeIds.filter(id => !current.includes(id));
    const remove = current.filter(id => !input.attendeeIds.includes(id));
    if (add.length) {
      const res = await supabase
        .from('calendar_event_attendees')
        .insert(add.map(user_id => ({ event_id: event.id, user_id })));
      if (res.error) return { error: res.error };
    }
    if (remove.length) {
      const res = await supabase
        .from('calendar_event_attendees')
        .delete()
        .eq('event_id', event.id)
        .in('user_id', remove);
      if (res.error) return { error: res.error };
    }
    return { error: null };
  },

  remove: async (eventId: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    return { error };
  },

  /** Ausências de colegas do mesmo departamento (só "ausente", dias aprovados). */
  listTeamAbsences: async (from: Date, to: Date) => {
    const { data, error } = await supabase.rpc('rz_team_absences', {
      p_from: format(from, 'yyyy-MM-dd'),
      p_to: format(to, 'yyyy-MM-dd'),
    });
    return { data: data ?? [], error };
  },

  /** Convites e respostas do evento (o RLS deixa ler ao organizador e aos admins). */
  history: async (eventId: string) => {
    const { data, error } = await supabase
      .from('calendar_attendee_history')
      .select('id, user_id, action, old_response, new_response, changed_at')
      .eq('event_id', eventId)
      .order('changed_at', { ascending: false })
      .limit(100);
    return { data: data ?? [], error };
  },

  respond: async (eventId: string, userId: string, response: AttendeeResponse) => {
    const { error } = await supabase
      .from('calendar_event_attendees')
      .update({ response })
      .match({ event_id: eventId, user_id: userId });
    return { error };
  },
};
