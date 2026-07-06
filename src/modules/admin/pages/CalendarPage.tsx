import { useEffect, useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  parseISO,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, Printer } from 'lucide-react';
import logoRealize from '@/assets/logo-realize.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { isWeekend, isBusinessDay, countBusinessDays } from '@/lib/vacation-utils';
import {
  absenceTypeLabels,
  absenceTypeColors,
  defaultAbsenceTypeColor,
} from '@/lib/absence-types';
import CalendarPrintDialog from '@/components/admin/CalendarPrintDialog';

interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  business_days?: number;
}

interface Absence {
  id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  absence_periods?: AbsencePeriod[];
  employees: {
    name: string;
    companies: { name: string };
  };
}

interface AbsenceWithDayStatus extends Absence {
  dayStatus: string;
}

interface Company {
  id: string;
  name: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
  is_national: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
};

/** Format a day count for display: 10 → "10", 0.5 → "0,5". */
const fmtDays = (n: number): string =>
  n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',');

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchData = async () => {
    try {
      const currentYear = currentDate.getFullYear();
      const [absencesRes, companiesRes, holidaysRes] = await Promise.all([
        supabase
          .from('absences')
          .select('*, employees(name, companies(name)), absence_periods(*)')
          .gte('end_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('start_date', format(monthEnd, 'yyyy-MM-dd')),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('holidays').select('*').eq('year', currentYear),
      ]);

      if (absencesRes.error) throw absencesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (holidaysRes.error) throw holidaysRes.error;

      setAbsences(absencesRes.data || []);
      setCompanies(companiesRes.data || []);
      setHolidays(holidaysRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const getAbsencesForDay = (day: Date): AbsenceWithDayStatus[] => {
    // Não mostrar ausências nos fins de semana ou feriados
    if (isWeekend(day) || getHolidayForDay(day)) return [];

    const results: AbsenceWithDayStatus[] = [];

    for (const absence of filteredAbsences) {
      // Se tem períodos definidos, verificar apenas os períodos (não o range principal)
      if (absence.absence_periods && absence.absence_periods.length > 0) {
        const periodForDay = absence.absence_periods.find(period => {
          const pStart = parseISO(period.start_date);
          const pEnd = parseISO(period.end_date);
          return day >= pStart && day <= pEnd;
        });

        if (periodForDay) {
          let dayStatus = periodForDay.status || absence.status;

          // Fallback: se ainda for partially_approved, mostrar como pending
          if (dayStatus === 'partially_approved') {
            dayStatus = 'pending';
          }

          results.push({ ...absence, dayStatus });
        }
      } else {
        // Fallback: usar range principal se não há períodos
        const start = parseISO(absence.start_date);
        const end = parseISO(absence.end_date);

        if (day >= start && day <= end) {
          let dayStatus = absence.status;

          if (dayStatus === 'partially_approved') {
            dayStatus = 'pending';
          }

          results.push({ ...absence, dayStatus });
        }
      }
    }

    return results;
  };

  const getHolidayForDay = (day: Date): Holiday | undefined => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
  };

  const filteredAbsences =
    selectedCompany === 'all'
      ? absences
      : absences.filter(
          a => a.employees?.companies?.name === companies.find(c => c.id === selectedCompany)?.name
        );

  /**
   * Per-collaborator summary for the visible month: approved business days,
   * broken down by absence type (clipped to the month). Powers the side list.
   */
  const monthSummary = useMemo(() => {
    const perEmp = new Map<string, { name: string; parts: Map<string, number>; total: number }>();

    for (const absence of filteredAbsences) {
      const name = absence.employees?.name || '';
      if (!name) continue;
      const type = absence.absence_type;
      const periods = absence.absence_periods || [];

      const segments =
        periods.length > 0
          ? periods
              .filter(p => (p.status || absence.status) === 'approved')
              .map(p => ({
                start: parseISO(p.start_date),
                end: parseISO(p.end_date),
                partial: p.period_type === 'partial',
                bd: p.business_days != null ? Number(p.business_days) : null,
              }))
          : absence.status === 'approved'
            ? [
                {
                  start: parseISO(absence.start_date),
                  end: parseISO(absence.end_date),
                  partial: false,
                  bd: null,
                },
              ]
            : [];

      for (const seg of segments) {
        let days = 0;
        if (seg.partial) {
          if (seg.start >= monthStart && seg.start <= monthEnd && isBusinessDay(seg.start, holidays)) {
            days = seg.bd != null ? seg.bd : 0;
          }
        } else {
          const s = seg.start < monthStart ? monthStart : seg.start;
          const e = seg.end > monthEnd ? monthEnd : seg.end;
          if (s <= e) days = countBusinessDays(s, e, holidays);
        }
        if (days <= 0) continue;

        let rec = perEmp.get(name);
        if (!rec) {
          rec = { name, parts: new Map(), total: 0 };
          perEmp.set(name, rec);
        }
        rec.parts.set(type, (rec.parts.get(type) || 0) + days);
        rec.total += days;
      }
    }

    return Array.from(perEmp.values())
      .map(r => ({
        name: r.name,
        total: r.total,
        parts: Array.from(r.parts.entries()).sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [filteredAbsences, monthStart, monthEnd, holidays]);

  // Helper para formatar período com horas parciais
  const formatPeriodDisplay = (period: {
    startDate: string;
    endDate: string;
    periodType?: string;
    startTime?: string | null;
    endTime?: string | null;
  }) => {
    if (period.periodType === 'partial' && period.startTime && period.endTime) {
      return `${format(parseISO(period.startDate), 'dd/MM')} (${period.startTime}-${period.endTime})`;
    }
    return `${format(parseISO(period.startDate), 'dd/MM')} - ${format(parseISO(period.endDate), 'dd/MM/yyyy')}`;
  };

  // Função para obter apenas períodos aprovados para o resumo
  const getApprovedPeriodsForSummary = () => {
    const approvedPeriods: Array<{
      id: string;
      employeeName: string;
      companyName: string;
      absenceType: string;
      startDate: string;
      endDate: string;
      periodType?: string;
      startTime?: string | null;
      endTime?: string | null;
    }> = [];

    for (const absence of filteredAbsences) {
      if (absence.absence_periods && absence.absence_periods.length > 0) {
        for (const period of absence.absence_periods) {
          if (period.status === 'approved') {
            approvedPeriods.push({
              id: `${absence.id}-${period.id}`,
              employeeName: absence.employees?.name || '',
              companyName: absence.employees?.companies?.name || '',
              absenceType: absence.absence_type,
              startDate: period.start_date,
              endDate: period.end_date,
              periodType: period.period_type,
              startTime: period.start_time,
              endTime: period.end_time,
            });
          }
        }
      } else {
        if (absence.status === 'approved') {
          approvedPeriods.push({
            id: absence.id,
            employeeName: absence.employees?.name || '',
            companyName: absence.employees?.companies?.name || '',
            absenceType: absence.absence_type,
            startDate: absence.start_date,
            endDate: absence.end_date,
          });
        }
      }
    }

    const monthStartDate = monthStart;
    const monthEndDate = monthEnd;

    return approvedPeriods
      .filter(p => {
        const pStart = parseISO(p.startDate);
        const pEnd = parseISO(p.endDate);
        return pStart <= monthEndDate && pEnd >= monthStartDate;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  };

  return (
    <>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header - hidden on print */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
            <div>
              <h1 className="font-display text-3xl font-semibold">Calendário</h1>
              <p className="text-muted-foreground mt-1">Visualizar férias e ausências</p>
            </div>

            <div className="flex items-center gap-4">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setPrintDialogOpen(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Calendário
              </Button>
            </div>
          </div>

          {/* ========== PRINT-ONLY PROFESSIONAL REPORT ========== */}
          <div className="hidden print:block print-report">
            {/* Header com Logo */}
            <div className="flex items-center justify-between border-b-2 border-primary pb-4 mb-6">
              <img src={logoRealize} alt="Realize Consultadoria" className="h-14" />
              <div className="text-right text-sm text-muted-foreground">
                <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}</p>
              </div>
            </div>

            {/* Título do Relatório */}
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-semibold text-foreground">
                Relatório de Ausências Aprovadas
              </h1>
              <p className="text-lg text-muted-foreground mt-2 capitalize">
                {format(currentDate, "MMMM 'de' yyyy", { locale: pt })}
              </p>
              {selectedCompany !== 'all' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Empresa: {companies.find(c => c.id === selectedCompany)?.name}
                </p>
              )}
            </div>

            {/* Tabela de Ausências */}
            {(() => {
              const approvedPeriods = getApprovedPeriodsForSummary();

              return approvedPeriods.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma ausência aprovada para este mês
                </p>
              ) : (
                <>
                  <table className="w-full border-collapse print-table">
                    <thead>
                      <tr className="border-b-2 border-primary bg-secondary/50">
                        <th className="text-left py-3 px-4 font-semibold">Colaborador</th>
                        <th className="text-left py-3 px-4 font-semibold">Empresa</th>
                        <th className="text-left py-3 px-4 font-semibold">Tipo</th>
                        <th className="text-left py-3 px-4 font-semibold">Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedPeriods.map((period, index) => (
                        <tr key={period.id} className={index % 2 === 0 ? '' : 'bg-secondary/30'}>
                          <td className="py-3 px-4 border-b border-border">
                            {period.employeeName}
                          </td>
                          <td className="py-3 px-4 border-b border-border">{period.companyName}</td>
                          <td className="py-3 px-4 border-b border-border">
                            {absenceTypeLabels[period.absenceType]}
                          </td>
                          <td className="py-3 px-4 border-b border-border">
                            {formatPeriodDisplay(period)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t-2 border-primary flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Total: <strong>{approvedPeriods.length}</strong> ausência(s) aprovada(s)
                    </p>
                    <p className="text-xs text-muted-foreground">Realize Consultadoria</p>
                  </div>
                </>
              );
            })()}
          </div>
          {/* ========== END PRINT-ONLY REPORT ========== */}

          {/* Calendar (≈80%) + month summary (≈20%) — hidden on print */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(240px,1fr)] gap-6 print:hidden">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="print:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="font-display text-2xl capitalize print:text-xl">
                {format(currentDate, 'MMMM yyyy', { locale: pt })}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="print:hidden"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-sm font-medium py-2 ${
                      index === 0 || index === 6
                        ? 'text-muted-foreground/60'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month start */}
                {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[78px]" />
                ))}

                {days.map(day => {
                  const dayAbsences = getAbsencesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const holiday = getHolidayForDay(day);
                  const isWeekendDay = isWeekend(day);

                  return (
                    <Tooltip key={day.toISOString()}>
                      <TooltipTrigger asChild>
                        <div
                          className={`min-h-[78px] p-1.5 border rounded-lg transition-colors ${
                            isToday
                              ? 'border-gold bg-gold/5'
                              : holiday
                                ? 'border-primary/30 bg-primary/5'
                                : isWeekendDay
                                  ? 'border-border/50 bg-muted/30'
                                  : 'border-border'
                          }`}
                        >
                          <div
                            className={`text-sm font-medium mb-1 flex items-center gap-1 ${
                              isToday
                                ? 'text-gold'
                                : holiday
                                  ? 'text-primary'
                                  : isWeekendDay
                                    ? 'text-muted-foreground/60'
                                    : ''
                            }`}
                          >
                            {format(day, 'd')}
                            {holiday && (
                              <span className="text-[10px] text-primary truncate hidden lg:inline">
                                {holiday.name.length > 8
                                  ? holiday.name.slice(0, 8) + '…'
                                  : holiday.name}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5 overflow-hidden">
                            {dayAbsences.slice(0, 2).map(absence => (
                              <div
                                key={absence.id}
                                className={`text-xs truncate px-1 py-0.5 rounded ${statusColors[absence.dayStatus] || statusColors.pending} text-white`}
                              >
                                {absence.employees?.name?.split(' ')[0]}
                              </div>
                            ))}
                            {dayAbsences.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayAbsences.length - 2} mais
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      {(holiday || dayAbsences.length > 0) && (
                        <TooltipContent side="top" className="max-w-xs">
                          {holiday && (
                            <p className="font-medium text-primary mb-1">🎉 {holiday.name}</p>
                          )}
                          {dayAbsences.map(absence => {
                            // Find the period for this day to show time info
                            const periodForDay = absence.absence_periods?.find(p => {
                              const pStart = parseISO(p.start_date);
                              const pEnd = parseISO(p.end_date);
                              return day >= pStart && day <= pEnd;
                            });
                            const timeInfo =
                              periodForDay?.period_type === 'partial' &&
                              periodForDay.start_time &&
                              periodForDay.end_time
                                ? ` (${periodForDay.start_time}-${periodForDay.end_time})`
                                : '';
                            return (
                              <p key={absence.id} className="text-sm">
                                {absence.employees?.name} -{' '}
                                {absenceTypeLabels[absence.absence_type]}
                                {timeInfo}
                              </p>
                            );
                          })}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right column (≈20%): month summary — names, types and quantity */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">Resumo do mês</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: pt })} · ausências aprovadas
              </p>
            </CardHeader>
            <CardContent className="px-3">
              {monthSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nenhuma ausência aprovada este mês.
                </p>
              ) : (
                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {monthSummary.map(emp => (
                    <div key={emp.name} className="rounded-lg border p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-medium text-sm truncate">{emp.name}</span>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0">
                          {fmtDays(emp.total)}d
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {emp.parts.map(([type, days]) => {
                          const c = absenceTypeColors[type] || defaultAbsenceTypeColor;
                          return (
                            <span
                              key={type}
                              className="text-[11px] font-medium px-1.5 py-0.5 rounded border leading-tight"
                              style={{
                                backgroundColor: c.fill,
                                color: c.text,
                                borderColor: c.border,
                              }}
                            >
                              {absenceTypeLabels[type] || type} · {fmtDays(days)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Legend & Pending Requests - hidden on print */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-xl">Legenda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 print:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span className="text-sm">Aprovado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500" />
                    <span className="text-sm">Pendente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <span className="text-sm">Reprovado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-primary/30 bg-primary/10" />
                    <span className="text-sm">Feriado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-border/50 bg-muted/30" />
                    <span className="text-sm">Fim de semana</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card print:hidden">
              <CardHeader>
                <CardTitle className="font-display text-xl">Pedidos Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAbsences.filter(a => a.status === 'pending').length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum pedido pendente</p>
                ) : (
                  <div className="space-y-3">
                    {filteredAbsences
                      .filter(a => a.status === 'pending')
                      .slice(0, 5)
                      .map(absence => (
                        <div
                          key={absence.id}
                          className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{absence.employees?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                // Check if any period is partial
                                const partialPeriod = absence.absence_periods?.find(
                                  p => p.period_type === 'partial' && p.start_time && p.end_time
                                );
                                if (partialPeriod) {
                                  return `${format(new Date(partialPeriod.start_date), 'dd/MM')} (${partialPeriod.start_time}-${partialPeriod.end_time})`;
                                }
                                return `${format(new Date(absence.start_date), 'dd/MM')} - ${format(new Date(absence.end_date), 'dd/MM/yyyy')}`;
                              })()}
                            </p>
                          </div>
                          <Badge variant="outline">{absenceTypeLabels[absence.absence_type]}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>

      <CalendarPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        companies={companies}
        defaultCompany={selectedCompany}
        defaultDate={currentDate}
      />
    </>
  );
};

export default CalendarPage;
