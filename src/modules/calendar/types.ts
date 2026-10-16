// Tipos do Calendário (briefing §10).

export type EventRecurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EventVisibility = 'private' | 'participants' | 'company';
export type EventColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
export type AttendeeResponse = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: EventVisibility;
  recurrence: EventRecurrence | null;
  recurrenceUntil: string | null;
  reminderMinutes: number | null;
  color: EventColor;
  attendees: { userId: string; response: AttendeeResponse }[];
}

export type CalendarLayer =
  | 'mine'
  | 'invites'
  | 'company'
  | 'absences'
  | 'team'
  | 'holidays'
  | 'tasks';

/** Detalhe de blocos que não são eventos (abre na lateral, como um evento). */
export type CalendarInfo =
  | {
      kind: 'absence';
      typeLabel: string;
      pending: boolean;
      days: number;
      /** Só algumas horas (ex.: "09:00 – 13:00"). */
      hours?: string;
      notes: string | null;
      /** Os outros períodos do mesmo pedido. */
      siblings: { key: string; start: Date; end: Date; pending: boolean }[];
    }
  | { kind: 'holiday'; name: string; national: boolean }
  | { kind: 'team'; name: string };

/** Um bloco no calendário (ocorrência de evento, ausência, feriado ou prazo de tarefa). */
export interface CalendarItem {
  key: string;
  layer: CalendarLayer;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** Classes de cor (fundo + texto). */
  tone: string;
  event?: CalendarEvent;
  taskId?: string;
  info?: CalendarInfo;
}

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface EventInput {
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: EventVisibility;
  recurrence: EventRecurrence | null;
  recurrenceUntil: string | null;
  reminderMinutes: number | null;
  color: EventColor;
  attendeeIds: string[];
}
