// Eventos de exemplo (só na pré-visualização /dev/realize-2/calendario).
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import type { CalendarEvent } from '../types';

const at = (dayOffset: number, hour: number, minute = 0) =>
  setMinutes(setHours(addDays(startOfDay(new Date()), dayOffset), hour), minute).toISOString();

const base: Omit<CalendarEvent, 'id' | 'title' | 'startsAt' | 'endsAt'> = {
  ownerId: 'me',
  description: null,
  location: null,
  meetingUrl: null,
  allDay: false,
  visibility: 'participants',
  recurrence: null,
  recurrenceUntil: null,
  reminderMinutes: 15,
  color: 'violet',
  attendees: [],
};

export const DEMO_EVENTS: CalendarEvent[] = [
  {
    ...base,
    id: 'e1',
    title: 'Reunião de equipa',
    startsAt: at(0, 15),
    endsAt: at(0, 16),
    location: 'Sala 2',
    recurrence: 'weekly',
    attendees: [
      { userId: 'rui', response: 'accepted' },
      { userId: 'ana', response: 'pending' },
    ],
  },
  {
    ...base,
    id: 'e2',
    title: 'Entrevista com candidato',
    startsAt: at(1, 10, 30),
    endsAt: at(1, 11, 30),
    color: 'emerald',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
  },
  {
    ...base,
    id: 'e3',
    title: 'Formação de segurança rodoviária',
    ownerId: 'rui',
    startsAt: at(2, 9),
    endsAt: at(2, 12),
    color: 'amber',
    visibility: 'company',
  },
  {
    ...base,
    id: 'e4',
    title: 'Almoço com a direção',
    ownerId: 'marta',
    startsAt: at(4, 13),
    endsAt: at(4, 14, 30),
    color: 'rose',
    attendees: [{ userId: 'me', response: 'pending' }],
  },
];
