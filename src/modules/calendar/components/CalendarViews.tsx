import React, { useEffect, useRef } from 'react';
import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  format,
  isSameDay,
  isToday,
  startOfDay,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarItem } from '../types';
import { EVENT_DOTS, LAYERS } from '../lib/items';
import { MonthGrid } from './MonthGrid';

const onDay = (items: CalendarItem[], day: Date) =>
  items.filter(item => item.start <= endOfDay(day) && item.end >= startOfDay(day));

/** Cor forte do bloco (para os pontos do mês no telemóvel). */
const dotOf = (item: CalendarItem) =>
  item.event ? EVENT_DOTS[item.event.color] : LAYERS.find(l => l.key === item.layer)?.dot;

const Chip: React.FC<{
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  compact?: boolean;
}> = ({ item, onOpen, compact }) => (
  <button
    type="button"
    onClick={event => {
      event.stopPropagation();
      onOpen(item);
    }}
    className={cn(
      'block w-full truncate rounded-lg px-1.5 py-0.5 text-left text-[11.5px] font-semibold',
      item.tone
    )}
    title={item.title}
  >
    {!item.allDay && !compact && (
      <span className="mr-1 opacity-70">{format(item.start, 'HH:mm')}</span>
    )}
    {item.title}
  </button>
);

interface MonthViewProps {
  month: Date;
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  onDayClick: (day: Date) => void;
  isSelected?: (day: Date) => boolean;
}

/** Mês: até 3 blocos por dia e "+N" para os restantes. */
export const MonthView: React.FC<MonthViewProps> = ({
  month,
  items,
  onOpen,
  onDayClick,
  isSelected,
}) => (
  <MonthGrid
    month={month}
    onDayClick={onDayClick}
    isSelected={isSelected}
    renderDay={day => {
      const list = onDay(items, day);
      return (
        <>
          {/* Telemóvel: só pontos de cor; tocar no dia abre a vista do dia. */}
          <div className="flex flex-wrap gap-1 px-1 sm:hidden">
            {list.slice(0, 4).map(item => (
              <span key={item.key} className={cn('h-1.5 w-1.5 rounded-full', dotOf(item))} />
            ))}
          </div>
          <div className="hidden space-y-1 sm:block">
            {list.slice(0, 3).map(item => (
              <Chip key={item.key} item={item} onOpen={onOpen} />
            ))}
            {list.length > 3 && (
              <span className="px-1.5 text-[11px] font-bold text-rz-muted">+{list.length - 3}</span>
            )}
          </div>
        </>
      );
    }}
  />
);

const HOUR_PX = 52;

/** Semana ou dia: faixa de dia inteiro em cima e as horas em baixo. */
export const TimeGridView: React.FC<{
  start: Date;
  days: number;
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
}> = ({ start, days, items, onOpen }) => {
  const columns = eachDayOfInterval({ start, end: addDays(start, days - 1) });
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_PX * 7 - 12 });
  }, [start]);

  return (
    <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-rz-line">
      <div
        className="grid border-b border-rz-line"
        style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}
      >
        <div />
        {columns.map(day => (
          <div key={day.toISOString()} className="border-l border-rz-line px-2 py-2 text-center">
            <p className="text-[11px] font-bold uppercase text-rz-muted">
              {format(day, 'EEE', { locale: pt })}
            </p>
            <p
              className={cn(
                'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-extrabold',
                isToday(day) && 'bg-rz-primary text-white'
              )}
            >
              {format(day, 'd')}
            </p>
            <div className="mt-1 space-y-0.5">
              {onDay(items, day)
                .filter(i => i.allDay)
                .map(item => (
                  <Chip key={item.key} item={item} onOpen={onOpen} compact />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="rz-scroll relative max-h-[62vh] overflow-y-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))`,
            height: HOUR_PX * 24,
          }}
        >
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-2 text-[11px] text-rz-muted"
                style={{ top: h * HOUR_PX }}
              >
                {h > 0 && `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {columns.map(day => (
            <div
              key={day.toISOString()}
              className="relative border-l border-rz-line"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, hsl(var(--rz-line)) ${HOUR_PX - 1}px, hsl(var(--rz-line)) ${HOUR_PX}px)`,
              }}
            >
              {onDay(items, day)
                .filter(i => !i.allDay)
                .map((item, index) => {
                  const from = isSameDay(item.start, day) ? item.start : startOfDay(day);
                  const top = (differenceInMinutes(from, startOfDay(day)) / 60) * HOUR_PX;
                  const height = Math.max(22, (differenceInMinutes(item.end, from) / 60) * HOUR_PX);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onOpen(item)}
                      className={cn(
                        'absolute overflow-hidden rounded-xl px-2 py-1 text-left text-[12px] font-semibold shadow-sm',
                        item.tone
                      )}
                      style={{ top, height, left: 4 + (index % 3) * 10, right: 4 }}
                    >
                      <span className="block truncate">{item.title}</span>
                      <span className="block text-[11px] opacity-75">
                        {format(item.start, 'HH:mm')}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Agenda: os próximos dias com algo marcado, por ordem. */
export const AgendaView: React.FC<{
  start: Date;
  days: number;
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
}> = ({ start, days, items, onOpen }) => {
  const list = eachDayOfInterval({ start, end: addDays(start, days - 1) })
    .map(day => ({ day, items: onDay(items, day) }))
    .filter(entry => entry.items.length > 0);
  if (list.length === 0) {
    return (
      <p className="rounded-[24px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
        Nada marcado nos próximos dias.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {list.map(({ day, items: dayItems }) => (
        <section
          key={day.toISOString()}
          className="flex gap-4 rounded-[24px] bg-white p-4 ring-1 ring-rz-line"
        >
          <div className="w-14 shrink-0 text-center">
            <p className="text-[11px] font-bold uppercase text-rz-muted">
              {format(day, 'EEE', { locale: pt })}
            </p>
            <p className={cn('text-2xl font-extrabold', isToday(day) && 'text-rz-primary')}>
              {format(day, 'd')}
            </p>
            <p className="text-[11px] text-rz-muted">{format(day, 'MMM', { locale: pt })}</p>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {dayItems.map(item => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left',
                    item.tone
                  )}
                >
                  <span className="w-20 shrink-0 text-[12px] font-bold opacity-80">
                    {item.allDay
                      ? 'Dia todo'
                      : `${format(item.start, 'HH:mm')}–${format(item.end, 'HH:mm')}`}
                  </span>
                  <span className="truncate text-[14px] font-semibold">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
