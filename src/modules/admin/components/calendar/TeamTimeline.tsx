import React from 'react';
import { format, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isWeekend, type Holiday } from '@/lib/vacation-utils';
import { holidayOn, formatDays, isoDay, type DayEntry, type TeamRow } from '../../lib/teamCalendar';
import { entryStyle, entryTitle } from './entryStyle';

interface TeamTimelineProps {
  days: Date[];
  rows: TeamRow[];
  entriesByDay: DayEntry[][];
  holidays: Holiday[];
  showCompany: boolean;
  onDayClick: (day: Date) => void;
}

/** Quantas pessoas fora num dia: realça os dias com muita gente fora. */
const loadTone = (count: number, team: number) =>
  count === 0
    ? 'text-transparent'
    : count >= Math.max(3, team * 0.2)
      ? 'bg-rose-100 text-rose-700'
      : count >= 2
        ? 'bg-amber-100 text-amber-700'
        : 'text-rz-muted';

/** Mapa da equipa: uma linha por pessoa, uma coluna por dia, barras pelo tipo de ausência. */
export const TeamTimeline: React.FC<TeamTimelineProps> = ({
  days,
  rows,
  entriesByDay,
  holidays,
  showCompany,
  onDayClick,
}) => {
  const today = new Date();
  const column = days.map(day => ({
    day,
    off: isWeekend(day) || !!holidayOn(isoDay(day), holidays),
    holiday: holidayOn(isoDay(day), holidays),
    today: isSameDay(day, today),
  }));
  const shade = (index: number) =>
    column[index].today ? 'bg-rz-primary-soft' : column[index].off ? 'bg-rz-canvas' : '';

  return (
    <div className="rz-scroll overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[190px] bg-white px-4 pb-1 text-left align-bottom text-[12px] font-bold text-rz-muted">
              {rows.length} {rows.length === 1 ? 'pessoa' : 'pessoas'}
            </th>
            {column.map(({ day, holiday, today: isToday }, index) => (
              <th
                key={index}
                className={cn('min-w-[30px] px-0 pb-1 pt-2 font-normal', shade(index))}
                title={holiday?.name}
              >
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className="flex w-full flex-col items-center"
                >
                  <span className="text-[10px] font-semibold uppercase text-rz-muted">
                    {format(day, 'EEE', { locale: pt }).replace('.', '')}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-bold',
                      isToday && 'bg-rz-primary text-white',
                      holiday && !isToday && 'text-rose-600'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </button>
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-white px-3 pb-1 text-right align-bottom text-[12px] font-bold text-rz-muted">
              Dias
            </th>
          </tr>
          <tr>
            <th className="sticky left-0 z-10 border-b border-rz-line bg-white px-4 pb-2 text-left text-[11.5px] font-semibold text-rz-muted">
              Fora por dia
            </th>
            {entriesByDay.map((entries, index) => (
              <th key={index} className={cn('border-b border-rz-line px-0.5 pb-2', shade(index))}>
                <span
                  className={cn(
                    'mx-auto block w-6 rounded-md text-[11px] font-bold leading-5',
                    loadTone(entries.length, rows.length)
                  )}
                >
                  {entries.length}
                </span>
              </th>
            ))}
            <th className="sticky right-0 z-10 border-b border-rz-line bg-white" />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.employeeId} className="group">
              <td className="sticky left-0 z-10 border-b border-rz-line bg-white px-4 py-1.5 group-hover:bg-rz-canvas">
                <span className="block max-w-[200px] truncate font-semibold">{row.name}</span>
                {showCompany && (
                  <span className="block max-w-[200px] truncate text-[11.5px] text-rz-muted">
                    {row.companyName}
                  </span>
                )}
              </td>
              {row.cells.map((entry, index) => {
                const prev = row.cells[index - 1];
                const next = row.cells[index + 1];
                const starts = !prev || prev.absenceId !== entry?.absenceId;
                const ends = !next || next.absenceId !== entry?.absenceId;
                return (
                  <td key={index} className={cn('h-11 border-b border-rz-line p-0', shade(index))}>
                    {entry && (
                      <button
                        type="button"
                        onClick={() => onDayClick(days[index])}
                        title={entryTitle(entry)}
                        style={entryStyle(entry)}
                        className={cn(
                          'block w-full transition-opacity hover:opacity-80',
                          entry.partial ? 'h-3' : 'h-6',
                          starts && 'ml-0.5 rounded-l-lg',
                          ends && 'rounded-r-lg',
                          starts && ends
                            ? 'w-[calc(100%-4px)]'
                            : starts || ends
                              ? 'w-[calc(100%-2px)]'
                              : ''
                        )}
                      />
                    )}
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 border-b border-rz-line bg-white px-3 text-right font-bold tabular-nums group-hover:bg-rz-canvas">
                {row.approvedDays > 0 ? formatDays(row.approvedDays) : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
