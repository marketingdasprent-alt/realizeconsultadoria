import React, { useMemo, useState } from 'react';
import { CalendarX2, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CalendarPrintDialog from '@/components/admin/CalendarPrintDialog';
import { useAdminCalendar } from '../../hooks/useAdminCalendar';
import { useVacationReport } from '../../hooks/useVacationReport';
import { buildTeamRows, isoDay } from '../../lib/teamCalendar';
import { CalendarToolbar, type CalendarView } from './CalendarToolbar';
import { TeamTimeline } from './TeamTimeline';
import { AdminMonthGrid } from './AdminMonthGrid';
import { DayDetailsSheet } from './DayDetailsSheet';
import { AbsenceLegend } from './AbsenceLegend';
import { CalendarPrintReport } from './CalendarPrintReport';
import { AbsenceTypeFilter } from './AbsenceTypeFilter';
import { ABSENCE_TYPE_KEYS, absenceMapTitle } from '@/lib/absence-types';

const VIEW_KEY = 'rz.admin.calendar.view';
const TYPES_KEY = 'rz.admin.calendar.types';

/** Tipos escolhidos da última vez (neste browser); de início, todos. */
const readTypes = (): Set<string> => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TYPES_KEY) ?? 'null') as unknown;
    const known = Array.isArray(saved)
      ? saved.filter((t): t is string => ABSENCE_TYPE_KEYS.includes(String(t)))
      : [];
    return new Set(known.length ? known : ABSENCE_TYPE_KEYS);
  } catch {
    return new Set(ABSENCE_TYPE_KEYS);
  }
};

const readView = (): CalendarView => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'team';
  } catch {
    return 'team';
  }
};

/**
 * Calendário de ausências: "Equipa" (uma linha por pessoa ao longo do mês, com o total de
 * dias aprovados) ou "Mês" (grelha). Clicar num dia abre todos os ausentes desse dia.
 */
export const CalendarTab: React.FC<{ tabs: React.ReactNode }> = ({ tabs }) => {
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>(readView);
  const [companyId, setCompanyId] = useState('all');
  const [onlyAbsent, setOnlyAbsent] = useState(true);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [types, setTypes] = useState<Set<string>>(readTypes);

  const calendar = useAdminCalendar(month, companyId, types);
  const chosenTypes = ABSENCE_TYPE_KEYS.filter(type => types.has(type));
  const changeTypes = (next: Set<string>) => {
    setTypes(next);
    try {
      window.localStorage.setItem(TYPES_KEY, JSON.stringify([...next]));
    } catch {
      // Sem armazenamento: a escolha fica só nesta visita.
    }
  };
  const report = useVacationReport();
  const { days, entriesByDay, holidays } = calendar;
  const rows = useMemo(
    () => buildTeamRows(calendar.employees, entriesByDay, calendar.approvedDays, onlyAbsent),
    [calendar.employees, entriesByDay, calendar.approvedDays, onlyAbsent]
  );
  const companyName = calendar.companies.find(c => c.id === companyId)?.name ?? null;
  // A empresa por baixo do nome só ajuda quando a lista mistura empresas.
  const showCompany = new Set(rows.map(row => row.companyName)).size > 1;
  const openIndex = openDay ? days.findIndex(day => isoDay(day) === isoDay(openDay)) : -1;

  const changeView = (next: CalendarView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Sem armazenamento: a escolha fica só nesta visita.
    }
  };

  return (
    <>
      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabs}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={report.isGenerating || calendar.isLoading}
              onClick={() => report.generate(month.getFullYear(), calendar.employees)}
            >
              {report.isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Relatório de Férias
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4" />
              {absenceMapTitle(chosenTypes)}
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
          <CalendarToolbar
            month={month}
            onMonthChange={setMonth}
            view={view}
            onViewChange={changeView}
            companies={calendar.companies}
            companyId={companyId}
            onCompanyChange={setCompanyId}
            onlyAbsent={onlyAbsent}
            onOnlyAbsentChange={setOnlyAbsent}
            isFetching={calendar.isFetching}
          />
          <AbsenceTypeFilter
            value={types}
            onChange={changeTypes}
            className="border-b border-rz-line px-3 py-2.5"
          />

          {calendar.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map(key => (
                <div key={key} className="h-10 animate-pulse rounded-xl bg-rz-canvas" />
              ))}
            </div>
          ) : view === 'month' ? (
            <AdminMonthGrid
              days={days}
              entriesByDay={entriesByDay}
              holidays={holidays}
              onDayClick={setOpenDay}
            />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft">
                <CalendarX2 className="h-6 w-6 text-rz-primary" />
              </span>
              <p className="font-semibold">Ninguém ausente neste mês</p>
              <p className="text-[13px] text-rz-muted">
                {chosenTypes.length < ABSENCE_TYPE_KEYS.length
                  ? 'Só está a ver alguns tipos (em "Mostrar"). Escolha "Todos" ou desligue "Só com ausências".'
                  : 'Desligue "Só com ausências" para ver toda a equipa.'}
              </p>
            </div>
          ) : (
            <TeamTimeline
              days={days}
              rows={rows}
              entriesByDay={entriesByDay}
              holidays={holidays}
              showCompany={showCompany}
              onDayClick={setOpenDay}
            />
          )}
        </section>

        <AbsenceLegend />
      </div>

      <CalendarPrintReport
        month={month}
        monthStart={isoDay(days[0])}
        monthEnd={isoDay(days[days.length - 1])}
        absences={calendar.absences}
        companyName={companyName}
      />

      <DayDetailsSheet
        day={openDay}
        entries={openIndex >= 0 ? entriesByDay[openIndex] : []}
        holidays={holidays}
        showCompany={showCompany}
        onClose={() => setOpenDay(null)}
      />

      <CalendarPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        companies={calendar.companies}
        defaultCompany={companyId}
        defaultDate={month}
        defaultTypes={chosenTypes}
      />
    </>
  );
};
