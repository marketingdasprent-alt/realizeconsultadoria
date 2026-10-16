import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { AgendaView, MonthView, TimeGridView } from '../components/CalendarViews';
import { CalendarSidebar } from '../components/CalendarSidebar';
import { EventDetailSheet } from '../components/EventDetailSheet';
import { EventDialog } from '../components/EventDialog';
import { useCalendar } from '../hooks/useCalendar';
import type { CalendarEvent, CalendarItem, CalendarLayer, CalendarView } from '../types';

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'agenda', label: 'Agenda' },
];

const rangeOf = (view: CalendarView, anchor: Date): [Date, Date] => {
  if (view === 'month')
    return [
      startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    ];
  if (view === 'week')
    return [startOfWeek(anchor, { weekStartsOn: 1 }), endOfWeek(anchor, { weekStartsOn: 1 })];
  if (view === 'day') return [startOfDay(anchor), endOfDay(anchor)];
  return [startOfDay(anchor), endOfDay(addDays(anchor, 29))];
};

const move = (view: CalendarView, anchor: Date, step: number) =>
  view === 'month'
    ? addMonths(anchor, step)
    : view === 'week'
      ? addWeeks(anchor, step)
      : addDays(anchor, step * (view === 'agenda' ? 30 : 1));

/** Calendário (briefing §10): eventos, convites, férias e ausências, feriados e prazos. */
const CalendarPage: React.FC = () => {
  const { basePath } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [hidden, setHidden] = useState<Set<CalendarLayer>>(new Set());
  const [open, setOpen] = useState<CalendarItem | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [newDay, setNewDay] = useState<Date | null>(null);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [from, to] = useMemo(() => rangeOf(view, anchor), [view, anchor]);
  const cal = useCalendar(from, to);
  const items = cal.items.filter(item => !hidden.has(item.layer));

  // Aberto a partir de uma notificação (?evento=id).
  const eventId = params.get('evento');
  useEffect(() => {
    const event = eventId && cal.events.find(e => e.id === eventId);
    if (!event) return;
    setAnchor(new Date(event.startsAt));
    setOpen({
      key: event.id,
      layer: 'mine',
      title: event.title,
      start: new Date(event.startsAt),
      end: new Date(event.endsAt),
      allDay: event.allDay,
      tone: '',
      event,
    });
    setParams({}, { replace: true });
  }, [eventId, cal.events, setParams]);

  const openItem = (item: CalendarItem) => {
    if (item.event) setOpen(item);
    else if (item.taskId) navigate(`${basePath}/tarefas?tarefa=${item.taskId}`);
    else if (item.layer === 'absences') navigate(`${basePath}/pedidos`);
  };
  const dayClick = (day: Date) => {
    if (selecting) {
      const key = format(day, 'yyyy-MM-dd');
      setSelected(s => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else {
      setAnchor(day);
      setView('day');
    }
  };

  const title =
    view === 'month'
      ? format(anchor, 'MMMM yyyy', { locale: pt })
      : view === 'week'
        ? `${format(from, 'd MMM', { locale: pt })} – ${format(to, 'd MMM yyyy', { locale: pt })}`
        : view === 'day'
          ? format(anchor, "EEEE, d 'de' MMMM", { locale: pt })
          : 'Próximos 30 dias';

  return (
    <WorkspacePage>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[26px] font-extrabold">Calendário</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor(a => move(view, a, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-rz-line"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="h-9 rounded-full bg-white px-3 text-[13px] font-semibold ring-1 ring-rz-line"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setAnchor(a => move(view, a, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-rz-line"
            aria-label="Seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-[16px] font-bold first-letter:uppercase">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full bg-white p-1 ring-1 ring-rz-line">
            {VIEWS.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={cn(
                  'h-8 rounded-full px-3 text-[13px] font-semibold',
                  view === v.key ? 'bg-rz-ink text-white' : 'text-rz-muted'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setNewDay(null);
              setEditing('new');
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo evento</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative min-w-0">
          {cal.isLoading && (
            <Loader2 className="absolute right-4 top-3 z-10 h-4 w-4 animate-spin text-rz-primary" />
          )}
          {/* A grelha aparece logo; os eventos entram quando chegam. */}
          {view === 'month' ? (
            <MonthView
              month={anchor}
              items={items}
              onOpen={openItem}
              onDayClick={dayClick}
              isSelected={d => selected.has(format(d, 'yyyy-MM-dd'))}
            />
          ) : view === 'agenda' ? (
            <AgendaView start={from} days={30} items={items} onOpen={openItem} />
          ) : (
            <TimeGridView
              start={from}
              days={view === 'week' ? 7 : 1}
              items={items}
              onOpen={openItem}
            />
          )}
        </div>
        <CalendarSidebar
          hidden={hidden}
          onToggle={layer =>
            setHidden(h => {
              const next = new Set(h);
              if (next.has(layer)) next.delete(layer);
              else next.add(layer);
              return next;
            })
          }
          balance={cal.balance}
          selecting={selecting}
          selectedCount={selected.size}
          onStartSelecting={() => {
            setSelecting(true);
            setView('month');
          }}
          onCancelSelecting={() => {
            setSelecting(false);
            setSelected(new Set());
          }}
          onRequestVacation={() =>
            navigate(`${basePath}/pedidos?novo=1&dias=${[...selected].sort().join(',')}`)
          }
        />
      </div>

      <EventDetailSheet
        item={
          // Sempre a versão mais recente do evento (respostas em tempo real), não a cópia de quando abriu.
          open?.event
            ? { ...open, event: cal.events.find(e => e.id === open.event?.id) ?? open.event }
            : open
        }
        onClose={() => setOpen(null)}
        onEdit={e => {
          setOpen(null);
          setEditing(e);
        }}
        onDelete={setToDelete}
        onRespond={cal.respond}
      />
      <EventDialog
        open={!!editing}
        onOpenChange={v => !v && setEditing(null)}
        event={editing === 'new' ? null : editing}
        day={newDay}
        onSave={input =>
          editing && editing !== 'new' ? cal.update(editing, input) : cal.create(input)
        }
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar evento?"
        description="O evento é eliminado para todos os convidados (e todas as repetições)."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (toDelete) cal.remove(toDelete);
          setOpen(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </WorkspacePage>
  );
};

export default CalendarPage;
