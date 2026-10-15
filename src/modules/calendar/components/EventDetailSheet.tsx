import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Bell,
  Clock,
  Globe2,
  Link2,
  Lock,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  Users,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { EVENT_DOTS } from '../lib/items';
import type { AttendeeResponse, CalendarEvent, CalendarItem } from '../types';

const RESPONSES: { key: AttendeeResponse; label: string; tone: string }[] = [
  { key: 'accepted', label: 'Vou', tone: 'bg-emerald-500 text-white' },
  { key: 'tentative', label: 'Talvez', tone: 'bg-amber-400 text-white' },
  { key: 'declined', label: 'Não vou', tone: 'bg-rose-500 text-white' },
];
const RESPONSE_LABEL: Record<AttendeeResponse, string> = {
  pending: 'Por responder',
  accepted: 'Vai',
  tentative: 'Talvez',
  declined: 'Não vai',
};
const RECURRENCE: Record<string, string> = {
  daily: 'Todos os dias',
  weekly: 'Todas as semanas',
  monthly: 'Todos os meses',
  yearly: 'Todos os anos',
};

interface EventDetailSheetProps {
  item: CalendarItem | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onRespond: (event: CalendarEvent, response: AttendeeResponse) => void;
}

const Line: React.FC<{ icon: React.ElementType; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <p className="flex items-start gap-3 text-[14px]">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rz-muted" />{' '}
    <span className="min-w-0">{children}</span>
  </p>
);

/** Detalhe de um evento: quando, onde, ligação, convidados e a minha resposta. */
export const EventDetailSheet: React.FC<EventDetailSheetProps> = ({
  item,
  onClose,
  onEdit,
  onDelete,
  onRespond,
}) => {
  const { user } = useWorkspace();
  const { nameOf } = useDirectory();
  const event = item?.event;
  const mine = event?.attendees.find(a => a.userId === user.userId);
  const isOwner = event?.ownerId === user.userId;

  return (
    <Sheet open={!!event} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="rz-scroll w-full overflow-y-auto border-0 p-0 sm:max-w-md"
      >
        {event && item && (
          <div className="space-y-5 p-6">
            <div className="flex items-start gap-3 pr-6">
              <span className={cn('mt-2 h-3 w-3 shrink-0 rounded-full', EVENT_DOTS[event.color])} />
              <SheetTitle className="text-[22px] font-extrabold leading-tight">
                {event.title}
              </SheetTitle>
            </div>
            <div className="space-y-2.5">
              <Line icon={Clock}>
                {event.allDay
                  ? format(item.start, "EEEE, d 'de' MMMM", { locale: pt })
                  : `${format(item.start, "EEEE, d 'de' MMMM · HH:mm", { locale: pt })}–${format(item.end, 'HH:mm')}`}
              </Line>
              {event.recurrence && (
                <Line icon={Repeat}>
                  {RECURRENCE[event.recurrence]}
                  {event.recurrenceUntil &&
                    ` até ${format(new Date(`${event.recurrenceUntil}T00:00:00`), 'dd/MM/yyyy')}`}
                </Line>
              )}
              {event.location && <Line icon={MapPin}>{event.location}</Line>}
              {event.meetingUrl && (
                <Line icon={Link2}>
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-rz-primary hover:underline"
                  >
                    Entrar na reunião
                  </a>
                </Line>
              )}
              {event.reminderMinutes !== null && (
                <Line icon={Bell}>
                  Lembrete{' '}
                  {event.reminderMinutes === 0
                    ? 'na hora'
                    : `${event.reminderMinutes >= 60 ? `${event.reminderMinutes / 60} h` : `${event.reminderMinutes} min`} antes`}
                </Line>
              )}
              <Line
                icon={
                  event.visibility === 'company'
                    ? Globe2
                    : event.visibility === 'private'
                      ? Lock
                      : Users
                }
              >
                {event.visibility === 'company'
                  ? 'Visível para toda a empresa'
                  : event.visibility === 'private'
                    ? 'Só para si'
                    : 'Organizador e convidados'}
              </Line>
            </div>
            {event.description && (
              <p className="whitespace-pre-wrap rounded-2xl bg-rz-canvas p-4 text-[14px]">
                {event.description}
              </p>
            )}

            {mine && (
              <div>
                <p className="mb-2 text-[13px] font-bold">A sua resposta</p>
                <div className="flex gap-2">
                  {RESPONSES.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => onRespond(event, r.key)}
                      className={cn(
                        'flex-1 rounded-full py-2 text-[13px] font-bold ring-1',
                        mine.response === r.key
                          ? `${r.tone} ring-transparent`
                          : 'text-rz-muted ring-rz-line'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-[13px] font-bold">Participantes</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2.5 text-[14px]">
                  <UserAvatar name={nameOf(event.ownerId)} userId={event.ownerId} size="xs" />{' '}
                  <span className="flex-1 font-semibold">{nameOf(event.ownerId)}</span>{' '}
                  <span className="text-xs text-rz-muted">Organizador</span>
                </li>
                {event.attendees.map(a => (
                  <li key={a.userId} className="flex items-center gap-2.5 text-[14px]">
                    <UserAvatar name={nameOf(a.userId)} userId={a.userId} size="xs" />{' '}
                    <span className="flex-1">{nameOf(a.userId)}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        a.response === 'accepted'
                          ? 'text-emerald-600'
                          : a.response === 'declined'
                            ? 'text-rose-600'
                            : 'text-rz-muted'
                      )}
                    >
                      {RESPONSE_LABEL[a.response]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {isOwner && (
              <div className="flex gap-2 border-t border-rz-line pt-4">
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-canvas px-4 text-sm font-semibold"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(event)}
                  className="ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
