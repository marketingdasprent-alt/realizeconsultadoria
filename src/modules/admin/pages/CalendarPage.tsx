import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX2, ClipboardList, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import CalendarPrintDialog from '@/components/admin/CalendarPrintDialog';
import { ROUTES } from '@/lib/constants';
import { useAdminCalendar } from '../hooks/useAdminCalendar';
import { useVacationReport } from '../hooks/useVacationReport';
import { buildTeamRows, isoDay } from '../lib/teamCalendar';
import { CalendarToolbar, type CalendarView } from '../components/calendar/CalendarToolbar';
import { TeamTimeline } from '../components/calendar/TeamTimeline';
import { AdminMonthGrid } from '../components/calendar/AdminMonthGrid';
import { DayDetailsSheet } from '../components/calendar/DayDetailsSheet';
import { AbsenceLegend } from '../components/calendar/AbsenceLegend';
import { CalendarPrintReport } from '../components/calendar/CalendarPrintReport';

const VIEW_KEY = 'rz.admin.calendar.view';

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
const CalendarPage = () => {
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>(readView);
  const [companyId, setCompanyId] = useState('all');
  const [onlyAbsent, setOnlyAbsent] = useState(true);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const calendar = useAdminCalendar(month, companyId);
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
        <AdminPageHeader
          title="Férias e Ausências"
          description="Quem está fora, mapa de férias e saldos da equipa"
          actions={
            <>
              {calendar.pendingCount > 0 && (
                <Link
                  to={`${ROUTES.ADMIN.REQUESTS}?status=pending`}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-100 px-4 text-[13.5px] font-bold text-amber-800 transition-colors hover:bg-amber-200"
                >
                  <ClipboardList className="h-4 w-4" />
                  {calendar.pendingCount} por aprovar
                </Link>
              )}
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
                Mapa de Férias
              </Button>
            </>
          }
        />

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
                Desligue "Só com ausências" para ver toda a equipa.
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
      />
    </>
  );
};

export default CalendarPage;
